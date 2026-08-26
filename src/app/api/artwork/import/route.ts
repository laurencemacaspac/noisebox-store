import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
);

type ScanResult = {
  productId: number;
  artist: string;
  title: string;
  status: string;
  musicbrainzId?: string;
  front?: string | null;
  back?: string | null;
};

type ScanResponse = {
  success: boolean;
  summary?: {
    scanned?: number;
    approved?: number;
    needsReview?: number;
    noMatch?: number;
    errors?: number;
    nextStart?: number;
  };
  results?: ScanResult[];
};

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);

    const start = Math.max(
      1,
      Number.parseInt(searchParams.get("start") ?? "1", 10) || 1,
    );

    const limit = Math.min(
      25,
      Math.max(
        1,
        Number.parseInt(searchParams.get("limit") ?? "10", 10) || 10,
      ),
    );

    /*
     * Use the scanner we already built.
     *
     * IMPORTANT:
     * The scanner remains responsible for deciding whether a MusicBrainz
     * release is an approved match.
     *
     * This importer does NOT attempt to make its own matching decision.
     */
    const scanUrl = new URL("/api/artwork/scan", request.url);

    scanUrl.searchParams.set("start", String(start));
    scanUrl.searchParams.set("limit", String(limit));

    const scanResponse = await fetch(scanUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!scanResponse.ok) {
      const text = await scanResponse.text();

      return NextResponse.json(
        {
          success: false,
          error: "Artwork scanner failed.",
          scannerStatus: scanResponse.status,
          scannerResponse: text,
        },
        { status: 500 },
      );
    }

    const scanData = (await scanResponse.json()) as ScanResponse;

    if (!scanData.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Artwork scanner returned success=false.",
          scanner: scanData,
        },
        { status: 500 },
      );
    }

    const results = scanData.results ?? [];

    const approvedResults = results.filter(
      (result) => result.status === "approved",
    );

    let productsProcessed = 0;
    let productsWithArtwork = 0;
    let imagesInserted = 0;
    let imagesAlreadyExist = 0;
    let productsWithoutArtwork = 0;

    const errors: Array<{
      productId: number;
      artist: string;
      title: string;
      error: string;
    }> = [];

    const imported: Array<{
      productId: number;
      artist: string;
      title: string;
      front: string | null;
      back: string | null;
      inserted: number;
      skipped: number;
    }> = [];

    for (const result of approvedResults) {
      productsProcessed++;

      const artwork: Array<{
        url: string;
        type: "front" | "back";
        sortOrder: number;
      }> = [];

      if (result.front) {
        artwork.push({
          url: result.front.replace(/^http:\/\//i, "https://"),
          type: "front",
          sortOrder: 0,
        });
      }

      if (result.back) {
        artwork.push({
          url: result.back.replace(/^http:\/\//i, "https://"),
          type: "back",
          sortOrder: 1,
        });
      }

      if (artwork.length === 0) {
        productsWithoutArtwork++;

        imported.push({
          productId: result.productId,
          artist: result.artist,
          title: result.title,
          front: null,
          back: null,
          inserted: 0,
          skipped: 0,
        });

        continue;
      }

      productsWithArtwork++;

      let insertedForProduct = 0;
      let skippedForProduct = 0;

      for (const image of artwork) {
        /*
         * Check whether THIS automatic artwork image has already
         * been imported.
         *
         * Seller photos are ignored here and will never be deleted
         * or overwritten.
         */
        const { data: existingImage, error: existingError } = await supabase
          .from("product_images")
          .select("id")
          .eq("product_id", result.productId)
          .eq("image_url", image.url)
          .maybeSingle();

        if (existingError) {
          errors.push({
            productId: result.productId,
            artist: result.artist,
            title: result.title,
            error: existingError.message,
          });

          continue;
        }

        if (existingImage) {
          imagesAlreadyExist++;
          skippedForProduct++;
          continue;
        }

        /*
         * IMPORTANT:
         *
         * We do NOT make automatic artwork primary if the product
         * already has a seller-supplied primary image.
         */
        const { data: existingPrimary, error: primaryError } = await supabase
          .from("product_images")
          .select("id")
          .eq("product_id", result.productId)
          .eq("is_primary", true)
          .limit(1);

        if (primaryError) {
          errors.push({
            productId: result.productId,
            artist: result.artist,
            title: result.title,
            error: primaryError.message,
          });

          continue;
        }

        const hasPrimary =
          Array.isArray(existingPrimary) && existingPrimary.length > 0;

        /*
         * Front artwork becomes primary ONLY when the product
         * currently has no primary image.
         *
         * Therefore:
         *
         * Seller primary photo exists
         *      -> seller photo stays primary
         *
         * No primary photo exists
         *      -> official front cover becomes primary
         */
        const shouldBePrimary =
          image.type === "front" && !hasPrimary;

        const { error: insertError } = await supabase
          .from("product_images")
          .insert({
            product_id: result.productId,
            image_url: image.url,
            image_source: "cover_art_archive",
            sort_order: image.sortOrder,
            image_type: image.type,
            is_primary: shouldBePrimary,
          });

        if (insertError) {
          errors.push({
            productId: result.productId,
            artist: result.artist,
            title: result.title,
            error: insertError.message,
          });

          continue;
        }

        imagesInserted++;
        insertedForProduct++;
      }

      imported.push({
        productId: result.productId,
        artist: result.artist,
        title: result.title,
        front: result.front ?? null,
        back: result.back ?? null,
        inserted: insertedForProduct,
        skipped: skippedForProduct,
      });
    }

    const nextStart =
      scanData.summary?.nextStart ??
      start + limit;

    return NextResponse.json({
      success: errors.length === 0,

      mode: "WRITE - approved artwork imported",

      batch: {
        start,
        limit,
        scanned: scanData.summary?.scanned ?? results.length,
        nextStart,
      },

      summary: {
        approvedMatches: approvedResults.length,
        productsProcessed,
        productsWithArtwork,
        productsWithoutArtwork,
        imagesInserted,
        imagesAlreadyExist,
        errors: errors.length,
      },

      imported,

      errors,
    });
  } catch (error) {
    console.error("Artwork import error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Artwork import failed.",
      },
      { status: 500 },
    );
  }
}