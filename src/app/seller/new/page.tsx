"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Seller = {
  id: number;
  shop_name: string;
};

type ReleaseImage = {
  id: number;
  image_url: string;
  image_source: string | null;
  image_type: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
};

type Release = {
  id: number;
  artist: string | null;
  title: string;
  label: string | null;
  catalog_number: string | null;
  format: string | null;
  format_quantity: number | null;
  source: string | null;
  source_release_id: string | null;
  release_images: ReleaseImage[];
};

type ReleaseCard = Release & {
  primary_image_url: string | null;
};

const RELEASES_PER_PAGE = 24;

export default function NewSellerListingPage() {
  const [seller, setSeller] =
    useState<Seller | null>(null);

  const [
    loadingSeller,
    setLoadingSeller,
  ] = useState(true);

  const [
    loadingReleases,
    setLoadingReleases,
  ] = useState(true);

  const [releases, setReleases] =
    useState<ReleaseCard[]>([]);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    selectedFormat,
    setSelectedFormat,
  ] = useState("All");

  const [
    visibleCount,
    setVisibleCount,
  ] = useState(
    RELEASES_PER_PAGE,
  );

  const [error, setError] =
    useState("");

  /*
   * Load authenticated seller.
   */
  useEffect(() => {
    let mounted = true;

    async function loadSeller() {
      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (!mounted) {
          return;
        }

        if (
          userError ||
          !user
        ) {
          setSeller(null);
          return;
        }

        const {
          data: sellerData,
          error: sellerError,
        } = await supabase
          .from("sellers")
          .select(`
            id,
            shop_name
          `)
          .eq(
            "user_id",
            user.id,
          )
          .maybeSingle();

        if (!mounted) {
          return;
        }

        if (sellerError) {
          throw sellerError;
        }

        setSeller(
          (sellerData as Seller | null) ??
            null,
        );
      } catch (loadError) {
        console.error(
          "Seller lookup error:",
          loadError,
        );

        if (mounted) {
          setError(
            "Unable to load your seller account.",
          );
        }
      } finally {
        if (mounted) {
          setLoadingSeller(
            false,
          );
        }
      }
    }

    void loadSeller();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * Load the Noisebox RELEASE catalog.
   *
   * We search releases rather than
   * seller_listings.
   *
   * Multiple sellers can therefore sell
   * the same release without duplicating
   * the underlying release information.
   */
  useEffect(() => {
    let mounted = true;

    async function loadReleases() {
      setLoadingReleases(true);

      try {
        const {
          data,
          error: releasesError,
        } = await supabase
          .from("releases")
          .select(`
            id,
            artist,
            title,
            label,
            catalog_number,
            format,
            format_quantity,
            source,
            source_release_id,

            release_images (
              id,
              image_url,
              image_source,
              image_type,
              is_primary,
              sort_order
            )
          `)
          .order(
            "artist",
            {
              ascending: true,
            },
          )
          .order(
            "title",
            {
              ascending: true,
            },
          );

        if (releasesError) {
          throw releasesError;
        }

        if (!mounted) {
          return;
        }

        const releaseCards = (
          (data ?? []) as Release[]
        ).map((release) => {
          const images = [
            ...(release.release_images ??
              []),
          ].sort(
            (a, b) =>
              (a.sort_order ??
                0) -
              (b.sort_order ??
                0),
          );

          const primaryImage =
            images.find(
              (image) =>
                image.is_primary,
            );

          const frontImage =
            images.find(
              (image) =>
                image.image_type ===
                "front",
            );

          const selectedImage =
            primaryImage ??
            frontImage ??
            images[0] ??
            null;

          return {
            ...release,

            primary_image_url:
              selectedImage
                ?.image_url ??
              null,
          };
        });

        setReleases(
          releaseCards,
        );
      } catch (loadError) {
        console.error(
          "Release catalog error:",
          loadError,
        );

        if (mounted) {
          setReleases([]);

          setError(
            "Unable to load the Noisebox release catalog.",
          );
        }
      } finally {
        if (mounted) {
          setLoadingReleases(
            false,
          );
        }
      }
    }

    void loadReleases();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * Build format filter options from
   * releases currently in Noisebox.
   */
  const formats = useMemo(
    () => [
      "All",

      ...Array.from(
        new Set(
          releases
            .map(
              (release) =>
                release.format,
            )
            .filter(
              (
                format,
              ): format is string =>
                Boolean(
                  format,
                ),
            ),
        ),
      ).sort((a, b) =>
        a.localeCompare(b),
      ),
    ],
    [releases],
  );

  /*
   * Search the Noisebox catalog.
   *
   * IMPORTANT:
   * Nothing is returned until the seller
   * actually enters a search.
   */
  const filteredReleases =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      /*
       * Hide the entire catalog by
       * default.
       */
      if (!search) {
        return [];
      }

      return releases.filter(
        (release) => {
          const matchesFormat =
            selectedFormat ===
              "All" ||
            release.format ===
              selectedFormat;

          const searchableText =
            [
              release.artist,
              release.title,
              release.format,
              release.label,
              release.catalog_number,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          const matchesSearch =
            searchableText.includes(
              search,
            );

          return (
            matchesFormat &&
            matchesSearch
          );
        },
      );
    }, [
      releases,
      searchTerm,
      selectedFormat,
    ]);

  const visibleReleases =
    filteredReleases.slice(
      0,
      visibleCount,
    );

  const hasMore =
    visibleCount <
    filteredReleases.length;

  const hasSearch =
    searchTerm.trim().length >
    0;

  function handleSearch(
    value: string,
  ) {
    setSearchTerm(value);

    setVisibleCount(
      RELEASES_PER_PAGE,
    );
  }

  function handleFormat(
    value: string,
  ) {
    setSelectedFormat(
      value,
    );

    setVisibleCount(
      RELEASES_PER_PAGE,
    );
  }

  if (
    loadingSeller ||
    loadingReleases
  ) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-gray-500">
          Loading release
          catalog...
        </p>
      </main>
    );
  }

  if (!seller) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <Link
          href="/seller"
          className="text-sm text-gray-500 hover:text-black"
        >
          ← Seller Dashboard
        </Link>

        <div className="mt-10 max-w-2xl">
          <h1 className="text-4xl font-bold">
            Seller account
            required
          </h1>

          <p className="mt-4 leading-7 text-gray-600">
            Create your
            Noisebox shop
            before listing an
            item.
          </p>

          <Link
            href="/seller/setup"
            className="mt-6 inline-flex bg-black px-6 py-3 font-medium text-white"
          >
            Set Up Your Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      {/* HEADER */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Link
          href="/seller"
          className="text-sm text-gray-500 hover:text-black"
        >
          ← Seller Dashboard
        </Link>

        <div className="mt-8">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            {seller.shop_name}
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            List an Item
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-600">
            Find your release
            in the Noisebox
            catalog. If it
            already exists,
            select it and add
            your price,
            condition, and
            quantity.
          </p>
        </div>
      </section>

      {/* CATALOG */}
      <section className="border-t border-gray-200 bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
              Noisebox Catalog
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Find Your Release
            </h2>
          </div>

          {/* SEARCH + FILTER */}
          <div className="mb-10 grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="release-search"
                className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-500"
              >
                Search
              </label>

              <input
                id="release-search"
                type="text"
                value={
                  searchTerm
                }
                onChange={(
                  event,
                ) =>
                  handleSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Search artist, title, label or catalog number..."
                autoComplete="off"
                className="h-14 w-full border border-gray-300 bg-white px-5 text-sm outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label
                htmlFor="release-format"
                className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-500"
              >
                Filter by
                Format
              </label>

              <select
                id="release-format"
                value={
                  selectedFormat
                }
                onChange={(
                  event,
                ) =>
                  handleFormat(
                    event.target
                      .value,
                  )
                }
                className="h-14 w-full border border-gray-300 bg-white px-5 text-sm outline-none transition focus:border-black"
              >
                {formats.map(
                  (format) => (
                    <option
                      key={
                        format
                      }
                      value={
                        format
                      }
                    >
                      {format ===
                      "All"
                        ? "All Formats"
                        : format}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-8 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {error}
            </div>
          )}

          {/*
           * BEFORE SEARCH:
           * Don't show any products.
           */}
          {!hasSearch ? (
            <div className="border border-gray-200 bg-white px-6 py-14 text-center">
              <p className="font-medium">
                Search the
                Noisebox catalog
              </p>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
                Enter an artist,
                release title,
                label, or catalog
                number above to
                find the item you
                want to sell.
              </p>
            </div>
          ) : visibleReleases.length >
            0 ? (
            <>
              {/* RESULT COUNT */}
              <div className="mb-8 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
                <p>
                  {
                    filteredReleases.length
                  }{" "}
                  {filteredReleases.length ===
                  1
                    ? "release"
                    : "releases"}{" "}
                  found
                </p>

                <p>
                  Showing{" "}
                  {
                    visibleReleases.length
                  }{" "}
                  of{" "}
                  {
                    filteredReleases.length
                  }
                </p>
              </div>

              {/* RELEASE GRID */}
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {visibleReleases.map(
                  (
                    release,
                  ) => (
                    <article
                      key={
                        release.id
                      }
                      className="group"
                    >
                      {/* ARTWORK */}
                      <div className="relative aspect-square overflow-hidden bg-gray-200">
                        {release.primary_image_url ? (
                          <Image
                            src={
                              release.primary_image_url
                            }
                            alt={`${release.artist ?? "Unknown Artist"} - ${release.title}`}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center p-5 text-center">
                            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">
                              No Image
                            </span>
                          </div>
                        )}
                      </div>

                      {/* RELEASE INFO */}
                      <div className="pt-4">
                        <p className="truncate text-sm text-gray-500">
                          {release.artist ??
                            "Unknown Artist"}
                        </p>

                        <h3 className="mt-1 line-clamp-2 min-h-[3rem] font-semibold leading-6">
                          {
                            release.title
                          }
                        </h3>

                        <div className="mt-2 min-h-[2.5rem] text-sm leading-5 text-gray-500">
                          {release.format && (
                            <p>
                              {
                                release.format
                              }
                            </p>
                          )}

                          {release.label && (
                            <p className="truncate">
                              {
                                release.label
                              }
                            </p>
                          )}

                          {release.catalog_number && (
                            <p className="truncate">
                              {
                                release.catalog_number
                              }
                            </p>
                          )}
                        </div>

                        <Link
                          href={`/seller/new/${release.id}`}
                          className="mt-4 flex w-full items-center justify-center bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                        >
                          Sell This
                          Release
                        </Link>
                      </div>
                    </article>
                  ),
                )}
              </div>

              {/* LOAD MORE */}
              {hasMore && (
                <div className="mt-14 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount(
                        (
                          current,
                        ) =>
                          current +
                          RELEASES_PER_PAGE,
                      )
                    }
                    className="flex min-w-56 items-center justify-center gap-3 bg-black px-8 py-4 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Load More

                    <span aria-hidden="true">
                      ↓
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /*
             * A search was performed,
             * but Noisebox has no match.
             */
            <div className="border border-gray-200 bg-white px-6 py-12 text-center">
              <p className="text-sm uppercase tracking-[0.2em] text-gray-500">
                No Noisebox
                Match
              </p>

              <h3 className="mt-3 text-xl font-semibold">
                Can&apos;t find
                your release?
              </h3>

              <p className="mx-auto mt-3 max-w-xl leading-7 text-gray-600">
                Search Discogs
                for the release,
                or create it
                manually if it
                isn&apos;t
                available there.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                {/*
                 * We'll connect
                 * Discogs search
                 * next.
                 */}
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed bg-gray-200 px-6 py-3 font-medium text-gray-500"
                >
                  Search Discogs
                </button>

                {/*
                 * Manual listing
                 * comes after
                 * Discogs search.
                 */}
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed border border-gray-300 px-6 py-3 font-medium text-gray-400"
                >
                  Create Manually
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* BULK IMPORT */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="border border-gray-200 p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            Bulk Selling
          </p>

          <h2 className="mt-3 text-2xl font-semibold">
            Already have a
            Discogs inventory?
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-gray-600">
            Upload your Discogs
            inventory CSV to add
            multiple items
            instead of listing
            each one
            individually.
          </p>

          <Link
            href="/seller/import"
            className="mt-6 inline-flex border border-gray-300 px-6 py-3 font-medium transition hover:border-black"
          >
            Import Discogs CSV
          </Link>
        </div>
      </section>
    </main>
  );
}