import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type DiscogsArtist = {
  name?: string;
};

type DiscogsLabel = {
  name?: string;
  catno?: string;
};

type DiscogsFormat = {
  name?: string;
  qty?: string;
  descriptions?: string[];
};

type DiscogsImage = {
  type?: string;
  uri?: string;
  uri150?: string;
};

type DiscogsTrack = {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
};

type DiscogsRelease = {
  id: number;
  title?: string;
  artists?: DiscogsArtist[];
  labels?: DiscogsLabel[];
  formats?: DiscogsFormat[];
  images?: DiscogsImage[];
  tracklist?: DiscogsTrack[];
};

function cleanArtistName(name: string) {
  /*
   * Discogs sometimes returns artist names
   * such as:
   *
   * Slowdive (2)
   *
   * Remove the Discogs disambiguation number
   * from the marketplace display name.
   */
  return name.replace(/\s+\(\d+\)$/, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const discogsReleaseId = Number(
      body?.discogsReleaseId,
    );

    if (
      !Number.isInteger(discogsReleaseId) ||
      discogsReleaseId <= 0
    ) {
      return NextResponse.json(
        {
          error: "A valid Discogs release ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const token = process.env.DISCOGS_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Discogs is not configured on the server.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Before importing anything, check whether
     * this exact Discogs release already exists
     * in Noisebox.
     *
     * If it does, reuse it instead of creating
     * duplicate release information.
     */
    const {
      data: existingRelease,
      error: existingReleaseError,
    } = await supabaseAdmin
      .from("releases")
      .select("id")
      .eq("source", "discogs")
      .eq(
        "source_release_id",
        String(discogsReleaseId),
      )
      .maybeSingle();

    if (existingReleaseError) {
      throw existingReleaseError;
    }

    if (existingRelease) {
      return NextResponse.json({
        releaseId: existingRelease.id,
        existing: true,
      });
    }

    /*
     * Fetch the complete Discogs release.
     *
     * Unlike database/search, this endpoint
     * includes detailed artwork and tracklist.
     */
    const discogsResponse = await fetch(
      `https://api.discogs.com/releases/${discogsReleaseId}`,
      {
        headers: {
          Authorization: `Discogs token=${token}`,
          "User-Agent":
            "NoiseboxMarketplace/1.0",
        },
        cache: "no-store",
      },
    );

    const discogsData =
      (await discogsResponse.json()) as
        | DiscogsRelease
        | {
            message?: string;
          };

    if (!discogsResponse.ok) {
      const message =
        "message" in discogsData
          ? discogsData.message
          : null;

      return NextResponse.json(
        {
          error:
            message ??
            "Unable to load the Discogs release.",
        },
        {
          status: discogsResponse.status,
        },
      );
    }

    const release =
      discogsData as DiscogsRelease;

    if (!release.title) {
      return NextResponse.json(
        {
          error:
            "The Discogs release does not contain a title.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Artist
     */
    const artist =
      release.artists
        ?.map((item) =>
          item.name
            ? cleanArtistName(item.name)
            : "",
        )
        .filter(Boolean)
        .join(", ") || null;

    /*
     * Discogs can return several labels.
     * For the main Noisebox release record,
     * use the first one.
     */
    const firstLabel =
      release.labels?.[0] ?? null;

    const label =
      firstLabel?.name?.trim() || null;

    const catalogNumber =
      firstLabel?.catno?.trim() || null;

    /*
     * Use the first Discogs format as the
     * primary physical format.
     *
     * Examples:
     * Vinyl
     * CD
     * Cassette
     */
    const firstFormat =
      release.formats?.[0] ?? null;

    const format =
      firstFormat?.name?.trim() || null;

    const parsedQuantity = Number(
      firstFormat?.qty ?? 1,
    );

    const formatQuantity =
      Number.isFinite(parsedQuantity) &&
      parsedQuantity > 0
        ? parsedQuantity
        : 1;

    /*
     * Create the shared Noisebox release.
     */
    const {
      data: createdRelease,
      error: createReleaseError,
    } = await supabaseAdmin
      .from("releases")
      .insert({
        artist,
        title: release.title.trim(),
        label,
        catalog_number: catalogNumber,
        format,
        format_quantity: formatQuantity,
        source: "discogs",
        source_release_id: String(release.id),
      })
      .select("id")
      .single();

    if (createReleaseError) {
      throw createReleaseError;
    }

    const releaseId =
      createdRelease.id as number;

    /*
     * Save Discogs artwork.
     */
    const imageRows = (
      release.images ?? []
    )
      .filter((image) => image.uri)
      .map((image, index) => ({
        release_id: releaseId,
        image_url: image.uri!,
        image_source: "discogs",

        /*
         * Discogs normally identifies images
         * as primary or secondary.
         *
         * We store the first image as the
         * Noisebox primary image.
         */
        image_type:
          index === 0
            ? "front"
            : image.type === "secondary"
              ? "secondary"
              : image.type ?? "secondary",

        is_primary: index === 0,
        sort_order: index,
      }));

    if (imageRows.length > 0) {
      const { error: imageError } =
        await supabaseAdmin
          .from("release_images")
          .insert(imageRows);

      if (imageError) {
        /*
         * Don't leave a partially imported
         * release behind.
         */
        await supabaseAdmin
          .from("releases")
          .delete()
          .eq("id", releaseId);

        throw imageError;
      }
    }

    /*
     * Save the tracklist.
     *
     * Discogs can include headings such as
     * "Side A". Those aren't actual songs,
     * so only track entries are imported.
     */
    const trackRows = (
      release.tracklist ?? []
    )
      .filter(
        (track) =>
          track.type_ !== "heading" &&
          Boolean(track.title?.trim()),
      )
      .map((track, index) => ({
        release_id: releaseId,

        position:
          track.position?.trim() ||
          null,

        title: track.title!.trim(),

        duration:
          track.duration?.trim() ||
          null,

        sort_order: index,
      }));

    if (trackRows.length > 0) {
      const { error: trackError } =
        await supabaseAdmin
          .from("release_tracks")
          .insert(trackRows);

      if (trackError) {
        /*
         * Because release_images and
         * release_tracks reference releases
         * with ON DELETE CASCADE, deleting
         * the release cleans up the partial
         * import.
         */
        await supabaseAdmin
          .from("releases")
          .delete()
          .eq("id", releaseId);

        throw trackError;
      }
    }

    return NextResponse.json({
      releaseId,
      existing: false,

      imported: {
        images: imageRows.length,
        tracks: trackRows.length,
      },
    });
  } catch (error) {
    console.error(
      "Discogs import error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to import the Discogs release.",
      },
      {
        status: 500,
      },
    );
  }
}