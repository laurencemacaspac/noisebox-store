import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const discogsToken =
  process.env.DISCOGS_TOKEN;

const discogsDevMode =
  process.env.DISCOGS_ARTWORK_DEV_MODE === "true";

const USER_AGENT =
  "NoiseboxStore/0.1 +private-development";

type DiscogsImage = {
  type?: string;
  uri?: string;
  uri150?: string;
  width?: number;
  height?: number;
};

type DiscogsRelease = {
  id?: number;
  title?: string;
  images?: DiscogsImage[];
};

export async function GET(
  request: NextRequest,
) {
  try {
    /*
     * Safety switch.
     *
     * This endpoint cannot import Discogs artwork unless
     * DISCOGS_ARTWORK_DEV_MODE=true.
     */
    if (!discogsDevMode) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Discogs development artwork mode is disabled.",
        },
        { status: 403 },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing Supabase environment variables.",
        },
        { status: 500 },
      );
    }

    if (!discogsToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DISCOGS_TOKEN is not configured.",
        },
        { status: 500 },
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const { searchParams } =
      new URL(request.url);

    const start = Math.max(
      1,
      Number.parseInt(
        searchParams.get("start") ?? "1",
        10,
      ) || 1,
    );

    /*
     * Keep batches deliberately small.
     *
     * We're calling an external API and don't want
     * a large batch to create unnecessary requests.
     */
    const limit = Math.min(
      10,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("limit") ?? "5",
          10,
        ) || 5,
      ),
    );

    /*
     * Get releases from our NEW shared-release table.
     */
    const {
      data: releases,
      error: releaseError,
    } = await supabase
      .from("releases")
      .select(
        `
          id,
          artist,
          title,
          source,
          source_release_id,
          release_images (
            id,
            image_url,
            image_source
          )
        `,
      )
      .gte("id", start)
      .order("id", {
        ascending: true,
      })
      .limit(limit);

    if (releaseError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to retrieve releases.",
          details: releaseError.message,
        },
        { status: 500 },
      );
    }

    const results: Array<{
      releaseId: number;
      artist: string | null;
      title: string;
      discogsReleaseId: string | null;
      status: string;
      image?: string;
      reason?: string;
    }> = [];

    let imagesInserted = 0;
    let alreadyHasArtwork = 0;
    let noDiscogsId = 0;
    let noDiscogsArtwork = 0;
    let errors = 0;

    for (const release of releases ?? []) {
      /*
       * IMPORTANT:
       *
       * If Noisebox already has ANY shared artwork,
       * Discogs does nothing.
       *
       * Permanent/shared artwork always wins.
       */
      if (
        Array.isArray(
          release.release_images,
        ) &&
        release.release_images.length > 0
      ) {
        alreadyHasArtwork++;

        results.push({
          releaseId: release.id,
          artist: release.artist,
          title: release.title,
          discogsReleaseId:
            release.source_release_id,
          status: "skipped",
          reason:
            "Release already has shared artwork.",
        });

        continue;
      }

      if (!release.source_release_id) {
        noDiscogsId++;

        results.push({
          releaseId: release.id,
          artist: release.artist,
          title: release.title,
          discogsReleaseId: null,
          status: "skipped",
          reason:
            "No source release ID available.",
        });

        continue;
      }

      /*
       * At the moment these IDs came from the
       * Discogs CSV import.
       *
       * Request the EXACT Discogs release.
       */
      const discogsUrl =
        `https://api.discogs.com/releases/` +
        encodeURIComponent(
          release.source_release_id,
        );

      try {
        const discogsResponse =
          await fetch(discogsUrl, {
            headers: {
              Authorization:
                `Discogs token=${discogsToken}`,
              "User-Agent": USER_AGENT,
              Accept: "application/json",
            },
            cache: "no-store",
          });

        if (!discogsResponse.ok) {
          errors++;

          results.push({
            releaseId: release.id,
            artist: release.artist,
            title: release.title,
            discogsReleaseId:
              release.source_release_id,
            status: "error",
            reason:
              `Discogs returned ${discogsResponse.status}.`,
          });

          continue;
        }

        const discogsRelease =
          (await discogsResponse.json()) as DiscogsRelease;

        const images =
          discogsRelease.images ?? [];

        /*
         * Prefer Discogs' primary image.
         * Otherwise use the first available image.
         */
        const primaryImage =
          images.find(
            (image) =>
              image.type === "primary" &&
              image.uri,
          ) ??
          images.find(
            (image) => Boolean(image.uri),
          );

        if (!primaryImage?.uri) {
          noDiscogsArtwork++;

          results.push({
            releaseId: release.id,
            artist: release.artist,
            title: release.title,
            discogsReleaseId:
              release.source_release_id,
            status: "no_artwork",
            reason:
              "Discogs release has no usable image.",
          });

          continue;
        }

        /*
         * Every Discogs development image gets this
         * exact source value.
         *
         * This is our kill switch / cleanup marker.
         */
        const imageSource =
          "discogs_dev_only";

        const {
          error: insertError,
        } = await supabase
          .from("release_images")
          .insert({
            release_id: release.id,
            image_url: primaryImage.uri,
            image_source: imageSource,
            image_type: "front",
            is_primary: true,
            sort_order: 0,
          });

        if (insertError) {
          errors++;

          results.push({
            releaseId: release.id,
            artist: release.artist,
            title: release.title,
            discogsReleaseId:
              release.source_release_id,
            status: "error",
            reason: insertError.message,
          });

          continue;
        }

        imagesInserted++;

        results.push({
          releaseId: release.id,
          artist: release.artist,
          title: release.title,
          discogsReleaseId:
            release.source_release_id,
          status: "imported",
          image: primaryImage.uri,
        });

        /*
         * Small pause between Discogs requests.
         */
        await new Promise((resolve) =>
          setTimeout(resolve, 300),
        );
      } catch (error) {
        errors++;

        results.push({
          releaseId: release.id,
          artist: release.artist,
          title: release.title,
          discogsReleaseId:
            release.source_release_id,
          status: "error",
          reason:
            error instanceof Error
              ? error.message
              : "Discogs request failed.",
        });
      }
    }

    const scanned =
      releases?.length ?? 0;

    const lastRelease =
      releases?.[scanned - 1];

    return NextResponse.json({
      success: errors === 0,

      mode:
        "PRIVATE DEVELOPMENT ONLY",

      imageSource:
        "discogs_dev_only",

      batch: {
        start,
        limit,
        scanned,

        nextStart:
          lastRelease
            ? lastRelease.id + 1
            : null,
      },

      summary: {
        imagesInserted,
        alreadyHasArtwork,
        noDiscogsId,
        noDiscogsArtwork,
        errors,
      },

      results,
    });
  } catch (error) {
    console.error(
      "Discogs development artwork error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Discogs development artwork import failed.",
      },
      { status: 500 },
    );
  }
}