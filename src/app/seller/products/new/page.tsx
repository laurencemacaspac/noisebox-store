"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ReleaseImage = {
  id: number;
  image_url: string;
  image_type: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
};

type Release = {
  id: number;
  artist: string | null;
  title: string;
  format: string | null;
  label: string | null;
  catalog_number: string | null;
  source: string | null;
  source_release_id: string | null;
  release_images: ReleaseImage[];
};

export default function NewSellerListingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Release[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      const { data, error } = await supabase
        .from("releases")
        .select(`
          id,
          artist,
          title,
          format,
          label,
          catalog_number,
          source,
          source_release_id,
          release_images (
            id,
            image_url,
            image_type,
            is_primary,
            sort_order
          )
        `)
        .or(
          `artist.ilike.%${normalizedSearch}%,title.ilike.%${normalizedSearch}%,catalog_number.ilike.%${normalizedSearch}%`,
        )
        .order("artist", {
          ascending: true,
        })
        .limit(24);

      if (error) {
        throw error;
      }

      setResults((data ?? []) as Release[]);
      setSearched(true);
    } catch (error) {
      console.error("Release search failed:", error);

      setResults([]);
      setSearched(true);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Release search failed.",
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

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            Seller
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Sell an Item
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-gray-600">
            Find the exact release you want to sell. Noisebox
            will reuse the existing release information and
            artwork so you only need to describe your copy.
          </p>
        </div>

        {/* Search */}
        <section>
          <label
            htmlFor="release-search"
            className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-500"
          >
            Find Your Release
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="release-search"
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Search artist, title, or catalog number..."
              autoComplete="off"
              className="h-14 flex-1 border border-gray-300 bg-white px-5 text-sm outline-none transition focus:border-black"
            />

            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={searching || !normalizedSearch}
              className="h-14 bg-black px-8 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </section>

        {/* Error */}
        {errorMessage && (
          <div className="mt-8 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Search Results */}
        {searched && !errorMessage && (
          <section className="mt-12">
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.2em] text-gray-500">
                Search Results
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                {results.length === 1
                  ? "1 Release Found"
                  : `${results.length} Releases Found`}
              </h2>
            </div>

            {results.length === 0 ? (
              <div className="border border-gray-200 px-6 py-16 text-center">
                <p className="font-medium">
                  We couldn&apos;t find that release.
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Try another artist, title, or catalog number.
                </p>

                <Link
                  href="/seller/releases/new"
                  className="mt-6 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
                >
                  Add a Release
                </Link>
              </div>
            ) : (
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {results.map((release) => {
                  const images = [
                    ...(release.release_images ?? []),
                  ].sort(
                    (a, b) =>
                      (a.sort_order ?? 0) -
                      (b.sort_order ?? 0),
                  );

                  const primaryImage = images.find(
                    (image) => image.is_primary,
                  );

                  const frontImage = images.find(
                    (image) =>
                      image.image_type === "front",
                  );

                  const selectedImage =
                    primaryImage ??
                    frontImage ??
                    images[0] ??
                    null;

                  return (
                    <article key={release.id}>
                      {/* Artwork */}
                      <div className="relative aspect-square overflow-hidden bg-gray-100">
                        {selectedImage ? (
                          <Image
                            src={selectedImage.image_url}
                            alt={
                              release.artist
                                ? `${release.artist} - ${release.title}`
                                : release.title
                            }
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400">
                            No artwork available
                          </div>
                        )}
                      </div>

                      {/* Release Details */}
                      <div className="pt-4">
                        {release.artist && (
                          <p className="text-sm text-gray-500">
                            {release.artist}
                          </p>
                        )}

                        <h3 className="mt-1 font-semibold leading-snug">
                          {release.title}
                        </h3>

                        <div className="mt-2 space-y-1 text-sm text-gray-500">
                          {release.format && (
                            <p>{release.format}</p>
                          )}

                          {release.label && (
                            <p>{release.label}</p>
                          )}

                          {release.catalog_number && (
                            <p>
                              Catalog: {release.catalog_number}
                            </p>
                          )}
                        </div>

                        <Link
                          href={`/seller/products/new/${release.id}`}
                          className="mt-5 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
                        >
                          Select Release
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Initial Explanation */}
        {!searched && (
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="font-semibold">
              Why select an existing release?
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Release information and artwork are shared across
              Noisebox. If another seller has already added the
              same pressing, you don&apos;t need to upload the
              cover or enter the release information again.
            </p>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Your price, condition, quantity, and seller notes
              will remain specific to your copy.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}