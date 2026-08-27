import { NextRequest, NextResponse } from "next/server";

type DiscogsSearchResult = {
  id: number;
  type: string;
  title: string;
  year?: string;
  country?: string;
  format?: string[];
  label?: string[];
  catno?: string;
  thumb?: string;
  cover_image?: string;
};

type DiscogsSearchResponse = {
  results?: DiscogsSearchResult[];
  message?: string;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        {
          error: "Search query is required.",
        },
        {
          status: 400,
        },
      );
    }

    const token = process.env.DISCOGS_TOKEN;

    if (!token) {
      console.error(
        "DISCOGS_TOKEN is missing from the environment.",
      );

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

    const url = new URL(
      "https://api.discogs.com/database/search",
    );

    url.searchParams.set("q", query);

    /*
     * We specifically want releases/pressings,
     * rather than artists, labels, or master
     * records.
     */
    url.searchParams.set("type", "release");

    /*
     * 24 works nicely with the 4-column
     * Noisebox grid.
     */
    url.searchParams.set("per_page", "24");
    url.searchParams.set("page", "1");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Discogs token=${token}`,

        /*
         * Discogs asks API clients to identify
         * themselves with a User-Agent.
         */
        "User-Agent":
          "NoiseboxMarketplace/1.0",
      },

      /*
       * Search results should be fresh rather
       * than permanently cached by Next.js.
       */
      cache: "no-store",
    });

    const data =
      (await response.json()) as DiscogsSearchResponse;

    if (!response.ok) {
      console.error(
        "Discogs search error:",
        response.status,
        data,
      );

      return NextResponse.json(
        {
          error:
            data.message ??
            "Discogs search failed.",
        },
        {
          status: response.status,
        },
      );
    }

    /*
     * Only expose the fields our frontend
     * actually needs.
     *
     * The Discogs token never leaves the
     * server.
     */
    const results = (data.results ?? []).map(
      (release) => ({
        id: release.id,
        title: release.title,
        year: release.year ?? null,
        country: release.country ?? null,

        format:
          release.format?.join(", ") ?? null,

        label:
          release.label?.join(", ") ?? null,

        catalog_number:
          release.catno ?? null,

        image_url:
          release.cover_image ??
          release.thumb ??
          null,
      }),
    );

    return NextResponse.json({
      results,
    });
  } catch (error) {
    console.error(
      "Discogs search route error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to search Discogs.",
      },
      {
        status: 500,
      },
    );
  }
}