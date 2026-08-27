"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DiscogsResult = {
  id: number;
  title: string;
  year: string | null;
  country: string | null;
  format: string | null;
  label: string | null;
  catalog_number: string | null;
  image_url: string | null;
};

type SearchResponse = {
  results?: DiscogsResult[];
  error?: string;
};

type ImportResponse = {
  releaseId?: number;
  existing?: boolean;

  imported?: {
    images: number;
    tracks: number;
  };

  error?: string;
};

export default function NewReleasePage() {
  const router = useRouter();

  const [searchTerm, setSearchTerm] =
    useState("");

  const [results, setResults] = useState<
    DiscogsResult[]
  >([]);

  const [searching, setSearching] =
    useState(false);

  const [searched, setSearched] =
    useState(false);

  const [
    importingReleaseId,
    setImportingReleaseId,
  ] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const normalizedSearch = useMemo(
    () => searchTerm.trim(),
    [searchTerm],
  );

  async function handleSearch() {
    if (!normalizedSearch) {
      setResults([]);
      setSearched(false);
      setErrorMessage("");
      return;
    }

    setSearching(true);
    setSearched(false);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/discogs/search?q=${encodeURIComponent(
          normalizedSearch,
        )}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data =
        (await response.json()) as SearchResponse;

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to search Discogs.",
        );
      }

      setResults(data.results ?? []);
      setSearched(true);
    } catch (error) {
      console.error(
        "Discogs search failed:",
        error,
      );

      setResults([]);
      setSearched(true);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to search Discogs.",
      );
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSearch();
    }
  }

  async function handleSelectRelease(
    discogsReleaseId: number,
  ) {
    if (importingReleaseId !== null) {
      return;
    }

    setImportingReleaseId(
      discogsReleaseId,
    );

    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/discogs/import",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            discogsReleaseId,
          }),
        },
      );

      const data =
        (await response.json()) as ImportResponse;

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to import this release.",
        );
      }

      if (!data.releaseId) {
        throw new Error(
          "The release was imported, but no Noisebox release ID was returned.",
        );
      }

      /*
       * The release now exists in Noisebox.
       *
       * Continue into the existing seller
       * listing page where the seller enters:
       *
       * price
       * media condition
       * sleeve condition
       * quantity
       * seller notes
       */
      router.push(
        `/seller/products/new/${data.releaseId}`,
      );
    } catch (error) {
      console.error(
        "Discogs import failed:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to import this release.",
      );

      setImportingReleaseId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* BACK */}
        <Link
          href="/seller/products/new"
          className="text-sm text-gray-500 transition hover:text-black"
        >
          ← Back to Noisebox Search
        </Link>

        {/* HEADER */}
        <div className="mt-8 mb-12">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            Add a Release
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Search Discogs
          </h1>

          <p className="mt-4 max-w-3xl leading-7 text-gray-600">
            If your release isn&apos;t already
            in Noisebox, search Discogs for the
            exact pressing you own. Noisebox
            can import its release information,
            artwork, and tracklist automatically.
          </p>
        </div>

        {/* SEARCH */}
        <section>
          <label
            htmlFor="discogs-search"
            className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-500"
          >
            Find Your Release
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="discogs-search"
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value,
                )
              }
              onKeyDown={handleKeyDown}
              placeholder="Search artist, title, catalog number..."
              autoComplete="off"
              className="h-14 flex-1 border border-gray-300 bg-white px-5 text-sm outline-none transition focus:border-black"
            />

            <button
              type="button"
              onClick={() =>
                void handleSearch()
              }
              disabled={
                searching ||
                !normalizedSearch
              }
              className="h-14 bg-black px-8 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {searching
                ? "Searching..."
                : "Search Discogs"}
            </button>
          </div>
        </section>

        {/* ERROR */}
        {errorMessage && (
          <div className="mt-8 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* SEARCH RESULTS */}
        {searched &&
          !errorMessage && (
            <section className="mt-12">
              <div className="mb-8">
                <p className="text-sm uppercase tracking-[0.2em] text-gray-500">
                  Discogs Results
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  {results.length === 1
                    ? "1 Release Found"
                    : `${results.length} Releases Found`}
                </h2>

                {results.length >
                  0 && (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                    Choose the exact
                    pressing you own. Check
                    the year, country,
                    format, label, and
                    catalog number before
                    selecting it.
                  </p>
                )}
              </div>

              {results.length ===
              0 ? (
                <div className="border border-gray-200 px-6 py-16 text-center">
                  <p className="font-medium">
                    We couldn&apos;t
                    find that release on
                    Discogs.
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    Try another artist,
                    title, or catalog
                    number, or create the
                    release manually.
                  </p>

                  {/*
                   * We'll build this route
                   * immediately after the
                   * Discogs flow is
                   * confirmed working.
                   */}
                  <Link
                    href="/seller/releases/new/manual"
                    className="mt-6 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
                  >
                    Create Manually
                  </Link>
                </div>
              ) : (
                <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                  {results.map(
                    (release) => {
                      const isImporting =
                        importingReleaseId ===
                        release.id;

                      const anotherImportIsRunning =
                        importingReleaseId !==
                          null &&
                        !isImporting;

                      return (
                        <article
                          key={
                            release.id
                          }
                        >
                          {/* ARTWORK */}
                          <div className="relative aspect-square overflow-hidden bg-gray-100">
                            {release.image_url ? (
                              <Image
                                src={
                                  release.image_url
                                }
                                alt={
                                  release.title
                                }
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400">
                                No artwork
                                available
                              </div>
                            )}
                          </div>

                          {/* DETAILS */}
                          <div className="pt-4">
                            <h3 className="font-semibold leading-snug">
                              {
                                release.title
                              }
                            </h3>

                            <div className="mt-3 space-y-1 text-sm text-gray-500">
                              {release.year && (
                                <p>
                                  Year:{" "}
                                  {
                                    release.year
                                  }
                                </p>
                              )}

                              {release.country && (
                                <p>
                                  Country:{" "}
                                  {
                                    release.country
                                  }
                                </p>
                              )}

                              {release.format && (
                                <p>
                                  {
                                    release.format
                                  }
                                </p>
                              )}

                              {release.label && (
                                <p className="line-clamp-2">
                                  Label:{" "}
                                  {
                                    release.label
                                  }
                                </p>
                              )}

                              {release.catalog_number && (
                                <p>
                                  Catalog:{" "}
                                  {
                                    release.catalog_number
                                  }
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void handleSelectRelease(
                                  release.id,
                                )
                              }
                              disabled={
                                importingReleaseId !==
                                null
                              }
                              className="mt-5 w-full bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                              {isImporting
                                ? "Importing..."
                                : anotherImportIsRunning
                                  ? "Please Wait..."
                                  : "Select Release"}
                            </button>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              )}
            </section>
          )}

        {/* INITIAL EXPLANATION */}
        {!searched && (
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="font-semibold">
              Why search Discogs?
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Different pressings of the
              same album can have different
              catalog numbers, countries,
              formats, artwork, and
              tracklists. Selecting the
              correct Discogs release helps
              buyers know exactly which
              version you&apos;re selling.
            </p>

            <div className="mt-6">
              <p className="text-sm text-gray-500">
                Can&apos;t find your
                release on Discogs?
              </p>

              <Link
                href="/seller/releases/new/manual"
                className="mt-3 inline-block border border-gray-300 px-5 py-3 text-sm font-medium transition hover:border-black"
              >
                Create Manually
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}