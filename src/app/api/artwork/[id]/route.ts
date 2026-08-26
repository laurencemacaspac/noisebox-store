import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  artist: string | null;
  title: string;
  label: string | null;
  catalog_number: string | null;
  format: string | null;
};

type MusicBrainzRelease = {
  id: string;
  title: string;
  score?: number;

  "artist-credit"?: Array<{
    name?: string;
  }>;

  "label-info"?: Array<{
    "catalog-number"?: string;
    label?: {
      name?: string;
    };
  }>;

  media?: Array<{
    format?: string;
  }>;
};

type CoverArtImage = {
  id: number | string;
  front: boolean;
  back: boolean;
  image: string;

  thumbnails?: {
    "500"?: string;
    "1200"?: string;
    small?: string;
    large?: string;
  };
};

type EvaluatedCandidate = {
  release: MusicBrainzRelease;
  artistMatches: boolean;
  titleMatches: boolean;
  catalogMatches: boolean;
  labelMatches: boolean;
  formatMatches: boolean;
  productCatalogNumbers: string[];
  releaseCatalogNumbers: string[];
  releaseLabels: string[];
  releaseFormats: string[];
};

const USER_AGENT =
  "Noisebox/0.1 (record marketplace development)";

/*
 * We deliberately limit alternate artwork checks.
 *
 * Otherwise one obscure release could result in dozens
 * of Cover Art Archive requests and make the scan
 * extremely slow.
 */
const MAX_ALTERNATE_ARTWORK_CHECKS = 5;

function escapeLucene(value: string) {
  return value.replace(
    /([+\-&|!(){}[\]^"~*?:\\/])/g,
    "\\$1",
  );
}

function normalize(
  value: string | null | undefined,
) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function forceHttps(url: string | null) {
  if (!url) {
    return null;
  }

  return url.replace(/^http:\/\//i, "https://");
}

function sleep(milliseconds: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds),
  );
}

function getCatalogNumbers(product: Product) {
  return (
    product.catalog_number
      ?.split(",")
      .map((value) => value.trim())
      .filter(
        (value) =>
          value &&
          value.toLowerCase() !== "none",
      ) ?? []
  );
}

function getReleaseCatalogNumbers(
  release: MusicBrainzRelease,
) {
  return (
    release["label-info"]
      ?.map((info) => info["catalog-number"])
      .filter(
        (value): value is string =>
          Boolean(value),
      ) ?? []
  );
}

function getReleaseLabels(
  release: MusicBrainzRelease,
) {
  return (
    release["label-info"]
      ?.map((info) => info.label?.name)
      .filter(
        (value): value is string =>
          Boolean(value),
      ) ?? []
  );
}

function getReleaseFormats(
  release: MusicBrainzRelease,
) {
  return (
    release.media
      ?.map((medium) => medium.format)
      .filter(
        (value): value is string =>
          Boolean(value),
      ) ?? []
  );
}

function getReleaseArtist(
  release: MusicBrainzRelease,
) {
  return (
    release["artist-credit"]
      ?.map((artist) => artist.name)
      .filter(Boolean)
      .join(", ") ?? ""
  );
}

function hasMatchingCatalogNumber(
  productCatalogNumbers: string[],
  releaseCatalogNumbers: string[],
) {
  return productCatalogNumbers.some(
    (productCatalog) =>
      releaseCatalogNumbers.some(
        (releaseCatalog) =>
          normalize(productCatalog) ===
          normalize(releaseCatalog),
      ),
  );
}

function labelLooksCompatible(
  productLabel: string | null,
  releaseLabels: string[],
) {
  if (
    !productLabel ||
    releaseLabels.length === 0
  ) {
    return false;
  }

  const normalizedProductLabel =
    normalize(productLabel);

  return releaseLabels.some((label) => {
    const normalizedReleaseLabel =
      normalize(label);

    return (
      normalizedProductLabel.includes(
        normalizedReleaseLabel,
      ) ||
      normalizedReleaseLabel.includes(
        normalizedProductLabel,
      )
    );
  });
}

function formatLooksCompatible(
  productFormat: string | null,
  releaseFormats: string[],
) {
  if (
    !productFormat ||
    releaseFormats.length === 0
  ) {
    return false;
  }

  const product = productFormat.toLowerCase();

  return releaseFormats.some(
    (releaseFormat) => {
      const release =
        releaseFormat.toLowerCase();

      /*
       * Vinyl / LP
       */
      if (
        product.includes("lp") ||
        product.includes("vinyl") ||
        product.includes('12"') ||
        product.includes('10"') ||
        product.includes('7"')
      ) {
        return (
          release.includes("vinyl") ||
          release.includes('12"') ||
          release.includes('10"') ||
          release.includes('7"')
        );
      }

      /*
       * CD
       */
      if (product.includes("cd")) {
        return release.includes("cd");
      }

      /*
       * Cassette
       */
      if (
        product.includes("cass") ||
        product.includes("cassette")
      ) {
        return release.includes("cassette");
      }

      return (
        normalize(productFormat) ===
        normalize(releaseFormat)
      );
    },
  );
}

function buildStrictSearchQuery(
  product: Product,
) {
  const queryParts: string[] = [];

  if (product.artist) {
    queryParts.push(
      `artist:"${escapeLucene(
        product.artist,
      )}"`,
    );
  }

  if (product.title) {
    queryParts.push(
      `release:"${escapeLucene(
        product.title,
      )}"`,
    );
  }

  const catalogNumbers =
    getCatalogNumbers(product);

  if (catalogNumbers.length > 0) {
    const catalogQuery = catalogNumbers
      .map(
        (catalogNumber) =>
          `catno:"${escapeLucene(
            catalogNumber,
          )}"`,
      )
      .join(" OR ");

    queryParts.push(`(${catalogQuery})`);
  }

  return queryParts.join(" AND ");
}

function buildFallbackSearchQuery(
  product: Product,
) {
  const queryParts: string[] = [];

  if (product.artist) {
    queryParts.push(
      `artist:"${escapeLucene(
        product.artist,
      )}"`,
    );
  }

  if (product.title) {
    queryParts.push(
      `release:"${escapeLucene(
        product.title,
      )}"`,
    );
  }

  return queryParts.join(" AND ");
}

/*
 * Fetch with retry protection.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3,
) {
  const retryableStatuses = [
    429,
    500,
    502,
    503,
    504,
  ];

  let lastResponse: Response | null = null;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    const response = await fetch(
      url,
      options,
    );

    lastResponse = response;

    if (response.ok) {
      return response;
    }

    const shouldRetry =
      retryableStatuses.includes(
        response.status,
      );

    if (
      !shouldRetry ||
      attempt === maxAttempts
    ) {
      return response;
    }

    const waitTime = attempt * 2000;

    console.log(
      `Temporary API error ${response.status}. Retrying in ${waitTime}ms...`,
    );

    await sleep(waitTime);
  }

  return lastResponse!;
}

async function runMusicBrainzSearch(
  query: string,
  limit = 10,
) {
  if (!query) {
    return [] as MusicBrainzRelease[];
  }

  const url = new URL(
    "https://musicbrainz.org/ws/2/release/",
  );

  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set(
    "limit",
    String(limit),
  );

  const response = await fetchWithRetry(
    url.toString(),
    {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    },
    3,
  );

  if (!response.ok) {
    throw new Error(
      `MusicBrainz returned ${response.status} after retries`,
    );
  }

  const data =
    (await response.json()) as {
      releases?: MusicBrainzRelease[];
    };

  return data.releases ?? [];
}

async function getCoverArt(
  releaseId: string,
) {
  const response = await fetchWithRetry(
    `https://coverartarchive.org/release/${releaseId}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    },
    3,
  );

  if (response.status === 404) {
    return [] as CoverArtImage[];
  }

  if (!response.ok) {
    throw new Error(
      `Cover Art Archive returned ${response.status} after retries`,
    );
  }

  const data =
    (await response.json()) as {
      images?: CoverArtImage[];
    };

  return data.images ?? [];
}

function getImageUrl(
  image: CoverArtImage | undefined,
) {
  if (!image) {
    return null;
  }

  const url =
    image.thumbnails?.["1200"] ??
    image.thumbnails?.large ??
    image.thumbnails?.["500"] ??
    image.thumbnails?.small ??
    image.image;

  return forceHttps(url);
}

function evaluateCandidate(
  product: Product,
  release: MusicBrainzRelease,
): EvaluatedCandidate {
  const productCatalogNumbers =
    getCatalogNumbers(product);

  const releaseCatalogNumbers =
    getReleaseCatalogNumbers(release);

  const releaseLabels =
    getReleaseLabels(release);

  const releaseFormats =
    getReleaseFormats(release);

  const artistMatches =
    normalize(product.artist) ===
    normalize(getReleaseArtist(release));

  const titleMatches =
    normalize(product.title) ===
    normalize(release.title);

  const catalogMatches =
    hasMatchingCatalogNumber(
      productCatalogNumbers,
      releaseCatalogNumbers,
    );

  const labelMatches =
    labelLooksCompatible(
      product.label,
      releaseLabels,
    );

  const formatMatches =
    formatLooksCompatible(
      product.format,
      releaseFormats,
    );

  return {
    release,
    artistMatches,
    titleMatches,
    catalogMatches,
    labelMatches,
    formatMatches,
    productCatalogNumbers,
    releaseCatalogNumbers,
    releaseLabels,
    releaseFormats,
  };
}

/*
 * Rank alternate editions.
 *
 * These are NOT used to identify the exact pressing.
 * They're only possible sources for a missing FRONT
 * cover.
 */
function rankAlternateCandidates(
  product: Product,
  releases: MusicBrainzRelease[],
  exactReleaseId: string,
) {
  return releases
    .filter(
      (release) =>
        release.id !== exactReleaseId,
    )
    .map((release) =>
      evaluateCandidate(product, release),
    )
    .filter(
      (candidate) =>
        candidate.artistMatches &&
        candidate.titleMatches &&
        candidate.formatMatches &&
        (candidate.release.score ?? 0) >=
          90,
    )
    .sort((a, b) => {
      let scoreA =
        a.release.score ?? 0;

      let scoreB =
        b.release.score ?? 0;

      /*
       * Prefer the same catalog number if another
       * result happens to contain it.
       */
      if (a.catalogMatches) {
        scoreA += 100;
      }

      if (b.catalogMatches) {
        scoreB += 100;
      }

      /*
       * Then prefer compatible labels.
       */
      if (a.labelMatches) {
        scoreA += 20;
      }

      if (b.labelMatches) {
        scoreB += 20;
      }

      return scoreB - scoreA;
    });
}

/*
 * Try a small number of other editions of the same
 * album to obtain a FRONT cover.
 *
 * We NEVER take the back cover from these releases.
 */
async function findAlternateFrontCover(
  product: Product,
  exactReleaseId: string,
  existingCandidates:
    MusicBrainzRelease[],
) {
  const fallbackQuery =
    buildFallbackSearchQuery(product);

  let releases = existingCandidates;

  /*
   * A strict search may contain only one release.
   * Get a broader artist/title result set so we can
   * examine alternate editions.
   */
  if (releases.length < 2) {
    await sleep(1100);

    releases =
      await runMusicBrainzSearch(
        fallbackQuery,
        25,
      );
  }

  const ranked =
    rankAlternateCandidates(
      product,
      releases,
      exactReleaseId,
    );

  const candidatesToCheck =
    ranked.slice(
      0,
      MAX_ALTERNATE_ARTWORK_CHECKS,
    );

  for (
    const candidate of
    candidatesToCheck
  ) {
    /*
     * Space Cover Art Archive requests.
     */
    await sleep(500);

    try {
      const images =
        await getCoverArt(
          candidate.release.id,
        );

      const frontImage =
        images.find(
          (image) => image.front,
        );

      const front =
        getImageUrl(frontImage);

      if (front) {
        return {
          front,
          releaseId:
            candidate.release.id,
          catalogNumbers:
            candidate.releaseCatalogNumbers,
          labels:
            candidate.releaseLabels,
          formats:
            candidate.releaseFormats,
        };
      }
    } catch (error) {
      /*
       * An alternate artwork failure should not
       * destroy an otherwise valid exact match.
       */
      console.warn(
        `Alternate artwork lookup failed for ${candidate.release.id}:`,
        error,
      );
    }
  }

  return null;
}

async function scanProduct(
  product: Product,
) {
  const strictQuery =
    buildStrictSearchQuery(product);

  /*
   * PASS 1
   * Artist + title + catalog number
   */
  let candidates =
    await runMusicBrainzSearch(
      strictQuery,
      10,
    );

  let searchPass:
    | "strict"
    | "fallback" = "strict";

  let fallbackQuery:
    | string
    | null = null;

  /*
   * PASS 2
   * Artist + title
   */
  if (candidates.length === 0) {
    searchPass = "fallback";

    fallbackQuery =
      buildFallbackSearchQuery(
        product,
      );

    await sleep(1100);

    candidates =
      await runMusicBrainzSearch(
        fallbackQuery,
        25,
      );
  }

  if (candidates.length === 0) {
    return {
      productId: product.id,
      artist: product.artist,
      title: product.title,

      status: "no_match",

      searchPass,
      strictQuery,
      fallbackQuery,

      front: null,
      back: null,

      frontMatch: "none",
      backMatch: "none",
    };
  }

  const evaluated =
    candidates.map((release) =>
      evaluateCandidate(
        product,
        release,
      ),
    );

  /*
   * Strongest possible candidate:
   *
   * Artist  ✓
   * Title   ✓
   * Catalog ✓
   * Format  ✓
   */
  const strongestCandidate =
    evaluated.find(
      (candidate) =>
        candidate.artistMatches &&
        candidate.titleMatches &&
        candidate.catalogMatches &&
        candidate.formatMatches,
    );

  /*
   * Artist + title + catalog.
   */
  const catalogCandidate =
    evaluated.find(
      (candidate) =>
        candidate.artistMatches &&
        candidate.titleMatches &&
        candidate.catalogMatches,
    );

  /*
   * Artist + title.
   */
  const reviewCandidate =
    evaluated.find(
      (candidate) =>
        candidate.artistMatches &&
        candidate.titleMatches,
    ) ?? evaluated[0];

  const selected =
    strongestCandidate ??
    catalogCandidate ??
    reviewCandidate;

  const match = selected.release;

  /*
   * EXACT PRESSING AUTO-APPROVAL
   *
   * Artist  ✓
   * Title   ✓
   * Catalog ✓
   * Format  ✓
   * Score >= 95
   */
  const highConfidence =
    selected.artistMatches &&
    selected.titleMatches &&
    selected.catalogMatches &&
    selected.formatMatches &&
    (match.score ?? 0) >= 95;

  if (!highConfidence) {
    return {
      productId: product.id,
      artist: product.artist,
      title: product.title,

      status: "needs_review",

      searchPass,
      strictQuery,
      fallbackQuery,

      musicbrainzId: match.id,

      score:
        match.score ?? null,

      checks: {
        artistMatches:
          selected.artistMatches,

        titleMatches:
          selected.titleMatches,

        catalogMatches:
          selected.catalogMatches,

        labelMatches:
          selected.labelMatches,

        formatMatches:
          selected.formatMatches,
      },

      productCatalogNumbers:
        selected.productCatalogNumbers,

      matchedCatalogNumbers:
        selected.releaseCatalogNumbers,

      matchedLabels:
        selected.releaseLabels,

      matchedFormats:
        selected.releaseFormats,

      front: null,
      back: null,

      frontMatch: "none",
      backMatch: "none",
    };
  }

  /*
   * FIRST:
   * Check exact pressing artwork.
   */
  await sleep(500);

  const exactImages =
    await getCoverArt(match.id);

  const exactFrontImage =
    exactImages.find(
      (image) => image.front,
    );

  const exactBackImage =
    exactImages.find(
      (image) => image.back,
    );

  let front =
    getImageUrl(
      exactFrontImage,
    );

  const back =
    getImageUrl(
      exactBackImage,
    );

  let frontMatch:
    | "exact"
    | "alternate_edition"
    | "none" = front
      ? "exact"
      : "none";

  const backMatch:
    | "exact"
    | "none" = back
      ? "exact"
      : "none";

  let alternateFront:
    | {
        releaseId: string;
        catalogNumbers: string[];
        labels: string[];
        formats: string[];
      }
    | null = null;

  /*
   * NEW:
   *
   * Exact pressing is valid, but it doesn't have
   * a front image.
   *
   * Look at compatible editions of the same album.
   */
  if (!front) {
    const alternate =
      await findAlternateFrontCover(
        product,
        match.id,
        candidates,
      );

    if (alternate) {
      front = alternate.front;

      frontMatch =
        "alternate_edition";

      alternateFront = {
        releaseId:
          alternate.releaseId,

        catalogNumbers:
          alternate.catalogNumbers,

        labels:
          alternate.labels,

        formats:
          alternate.formats,
      };
    }
  }

  return {
    productId: product.id,
    artist: product.artist,
    title: product.title,

    status: "approved",

    searchPass,

    musicbrainzId:
      match.id,

    score:
      match.score ?? null,

    checks: {
      artistMatches:
        selected.artistMatches,

      titleMatches:
        selected.titleMatches,

      catalogMatches:
        selected.catalogMatches,

      labelMatches:
        selected.labelMatches,

      formatMatches:
        selected.formatMatches,
    },

    productCatalogNumbers:
      selected.productCatalogNumbers,

    matchedCatalogNumbers:
      selected.releaseCatalogNumbers,

    matchedLabels:
      selected.releaseLabels,

    matchedFormats:
      selected.releaseFormats,

    front,
    back,

    /*
     * These make it easy for us to see whether
     * the improvement is actually helping.
     */
    frontMatch,
    backMatch,

    alternateFront,
  };
}

export async function GET(
  request: Request,
) {
  try {
    const url =
      new URL(request.url);

    const requestedStart =
      Number(
        url.searchParams.get(
          "start",
        ) ?? "1",
      );

    const requestedLimit =
      Number(
        url.searchParams.get(
          "limit",
        ) ?? "10",
      );

    const start =
      Number.isInteger(
        requestedStart,
      ) &&
      requestedStart > 0
        ? requestedStart
        : 1;

    /*
     * Maximum 25 products per batch.
     */
    const limit =
      Number.isInteger(
        requestedLimit,
      ) &&
      requestedLimit > 0
        ? Math.min(
            requestedLimit,
            25,
          )
        : 10;

    const {
      data: products,
      error,
    } = await supabase
      .from("products")
      .select(
        `
          id,
          artist,
          title,
          label,
          catalog_number,
          format
        `,
      )
      .gte("id", start)
      .order("id", {
        ascending: true,
      })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        {
          error:
            "Unable to retrieve inventory.",

          details:
            error.message,
        },
        { status: 500 },
      );
    }

    const results = [];

    for (
      const product of
        products ?? []
    ) {
      try {
        const result =
          await scanProduct(
            product,
          );

        results.push(result);
      } catch (error) {
        results.push({
          productId:
            product.id,

          artist:
            product.artist,

          title:
            product.title,

          status: "error",

          error:
            error instanceof Error
              ? error.message
              : "Unknown scanning error",
        });
      }

      /*
       * MusicBrainz asks clients to avoid
       * hammering the API. Keep product
       * processing spaced apart.
       */
      await sleep(1100);
    }

    const approved =
      results.filter(
        (result) =>
          result.status ===
          "approved",
      );

    const needsReview =
      results.filter(
        (result) =>
          result.status ===
          "needs_review",
      );

    const noMatch =
      results.filter(
        (result) =>
          result.status ===
          "no_match",
      );

    const errors =
      results.filter(
        (result) =>
          result.status ===
          "error",
      );

    const strictApprovals =
      approved.filter(
        (result) =>
          "searchPass" in result &&
          result.searchPass ===
            "strict",
      );

    const fallbackApprovals =
      approved.filter(
        (result) =>
          "searchPass" in result &&
          result.searchPass ===
            "fallback",
      );

    const exactFrontCovers =
      approved.filter(
        (result) =>
          "frontMatch" in result &&
          result.frontMatch ===
            "exact",
      );

    const alternateFrontCovers =
      approved.filter(
        (result) =>
          "frontMatch" in result &&
          result.frontMatch ===
            "alternate_edition",
      );

    const summary = {
      requestedStart: start,
      requestedLimit: limit,

      scanned:
        results.length,

      approved:
        approved.length,

      strictApprovals:
        strictApprovals.length,

      fallbackApprovals:
        fallbackApprovals.length,

      needsReview:
        needsReview.length,

      noMatch:
        noMatch.length,

      errors:
        errors.length,

      frontCoversFound:
        approved.filter(
          (result) =>
            "front" in result &&
            Boolean(result.front),
        ).length,

      /*
       * NEW diagnostic numbers.
       */
      exactFrontCovers:
        exactFrontCovers.length,

      alternateFrontCovers:
        alternateFrontCovers.length,

      backCoversFound:
        approved.filter(
          (result) =>
            "back" in result &&
            Boolean(result.back),
        ).length,

      nextStart:
        results.length > 0
          ? Math.max(
              ...results.map(
                (result) =>
                  result.productId,
              ),
            ) + 1
          : null,
    };

    return NextResponse.json({
      success: true,

      mode:
        "READ ONLY - database was not modified",

      artworkStrategy:
        "Exact pressing first; compatible alternate edition for missing front covers; back covers exact only",

      retryProtection:
        "Enabled",

      summary,
      results,
    });
  } catch (error) {
    console.error(
      "Artwork batch scan error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Artwork scan failed.",
      },
      { status: 500 },
    );
  }
}