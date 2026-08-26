"use client";

import { useEffect, useState } from "react";
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
  release_images: ReleaseImage[];
};

type SellerListing = {
  id: number;
  release_id: number;
  price: number | string;
  quantity: number;
  media_condition: string | null;
  sleeve_condition: string | null;
  seller_note: string | null;
  status: string;
  accept_offer: boolean;
  created_at: string;
  release: Release | Release[] | null;
};

const LISTINGS_PER_PAGE = 24;

export default function SellerListingsPage() {
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [visibleCount, setVisibleCount] =
    useState(LISTINGS_PER_PAGE);

  useEffect(() => {
    async function loadListings() {
      setLoading(true);
      setErrorMessage("");

      try {
        /*
         * Get the currently logged-in user.
         */
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error(
            "You must be signed in to view your listings.",
          );
        }

        /*
         * Find this user's seller account.
         */
        const {
          data: seller,
          error: sellerError,
        } = await supabase
          .from("sellers")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (sellerError) {
          throw sellerError;
        }

        if (!seller) {
          throw new Error(
            "No seller account was found for your account.",
          );
        }

        /*
         * Load this seller's listings.
         *
         * Newest listings appear first.
         */
        const {
          data,
          error,
        } = await supabase
          .from("seller_listings")
          .select(`
            id,
            release_id,
            price,
            quantity,
            media_condition,
            sleeve_condition,
            seller_note,
            status,
            accept_offer,
            created_at,

            release:releases!seller_listings_release_id_fkey (
              id,
              artist,
              title,
              format,
              label,
              catalog_number,

              release_images (
                id,
                image_url,
                image_type,
                is_primary,
                sort_order
              )
            )
          `)
          .eq("seller_id", seller.id)
          .order("created_at", {
            ascending: false,
          });

        if (error) {
          throw error;
        }

        setListings(
          (data ?? []) as SellerListing[],
        );
      } catch (error) {
        console.error(
          "Seller listings failed to load:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load your listings.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadListings();
  }, []);

  /*
   * Only render the first 24 listings initially.
   */
  const visibleListings = listings.slice(
    0,
    visibleCount,
  );

  const hasMore =
    visibleCount < listings.length;

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            Seller
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            My Listings
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-gray-600">
            View and manage the music you currently have
            listed for sale.
          </p>

          {/*
           * Keep the primary action attached to the
           * page introduction instead of floating
           * on the opposite side of the page.
           */}
          <div className="mt-6">
            <Link
              href="/seller/products/new"
              className="inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
            >
              Sell an Item
            </Link>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="border-t border-gray-200 py-12">
            <p className="text-gray-500">
              Loading your listings...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && errorMessage && (
          <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Empty State */}
        {!loading &&
          !errorMessage &&
          listings.length === 0 && (
            <div className="border border-gray-200 px-6 py-16 text-center">
              <h2 className="text-xl font-semibold">
                You don&apos;t have any listings yet.
              </h2>

              <p className="mt-2 text-gray-500">
                Find a release and list your first item
                for sale.
              </p>

              <Link
                href="/seller/products/new"
                className="mt-6 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
              >
                Sell an Item
              </Link>
            </div>
          )}

        {/* Listings */}
        {!loading &&
          !errorMessage &&
          listings.length > 0 && (
            <>
              {/* Listing Count */}
              <div className="mb-8 flex flex-wrap items-center justify-between gap-2 border-y border-gray-200 py-4 text-sm text-gray-500">
                <p>
                  {listings.length}{" "}
                  {listings.length === 1
                    ? "listing"
                    : "listings"}
                </p>

                <p>
                  Showing {visibleListings.length} of{" "}
                  {listings.length}
                </p>
              </div>

              {/* Same Grid System as Homepage */}
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {visibleListings.map((listing) => {
                  const release = Array.isArray(
                    listing.release,
                  )
                    ? listing.release[0]
                    : listing.release;

                  if (!release) {
                    return null;
                  }

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
                    <article key={listing.id}>
                      {/* Artwork */}
                      <Link
                        href={`/products/${listing.id}`}
                        className="relative block aspect-square overflow-hidden bg-gray-100"
                      >
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
                      </Link>

                      {/* Listing Details */}
                      <div className="pt-4">
                        {release.artist && (
                          <p className="text-sm text-gray-500">
                            {release.artist}
                          </p>
                        )}

                        <Link
                          href={`/products/${listing.id}`}
                          className="mt-1 block font-semibold leading-snug hover:underline"
                        >
                          {release.title}
                        </Link>

                        {release.format && (
                          <p className="mt-2 text-sm text-gray-500">
                            {release.format}
                          </p>
                        )}

                        <p className="mt-3 text-lg font-semibold">
                          $
                          {Number(
                            listing.price,
                          ).toFixed(2)}
                        </p>

                        {/* Condition */}
                        <div className="mt-3 space-y-1 text-sm text-gray-500">
                          {listing.media_condition && (
                            <p>
                              Media:{" "}
                              {listing.media_condition}
                            </p>
                          )}

                          {listing.sleeve_condition && (
                            <p>
                              Sleeve:{" "}
                              {listing.sleeve_condition}
                            </p>
                          )}

                          <p>
                            Quantity:{" "}
                            {listing.quantity}
                          </p>

                          <p>
                            Status:{" "}
                            {formatStatus(
                              listing.status,
                            )}
                          </p>

                          {listing.accept_offer && (
                            <p>
                              Offers accepted
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="mt-5 flex flex-wrap gap-2">
                          <Link
                            href={`/seller/listings/${listing.id}/edit`}
                            className="inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
                          >
                            Edit Listing
                          </Link>

                          <Link
                            href={`/products/${listing.id}`}
                            className="inline-block border border-gray-300 px-6 py-3 transition hover:border-black"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* View More */}
              {hasMore && (
                <div className="mt-14 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount(
                        (current) =>
                          current +
                          LISTINGS_PER_PAGE,
                      )
                    }
                    className="group flex min-w-56 items-center justify-center gap-3 rounded-full bg-black px-8 py-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-md"
                  >
                    <span>View More</span>

                    <span
                      aria-hidden="true"
                      className="text-lg leading-none transition-transform group-hover:translate-y-1"
                    >
                      ↓
                    </span>
                  </button>
                </div>
              )}

              {!hasMore &&
                listings.length >
                  LISTINGS_PER_PAGE && (
                  <p className="mt-12 text-center text-sm text-gray-500">
                    You&apos;ve reached the end of your
                    listings.
                  </p>
                )}
            </>
          )}
      </div>
    </main>
  );
}

function formatStatus(status: string) {
  switch (status) {
    case "for_sale":
      return "For Sale";

    case "sold":
      return "Sold";

    case "draft":
      return "Draft";

    case "inactive":
      return "Inactive";

    default:
      return status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) =>
          character.toUpperCase(),
        );
  }
}