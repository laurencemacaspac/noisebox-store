"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

type Listing = {
  id: number;
  seller_id: number;
  release_id: number;
  price: number | string;
  quantity: number;
  media_condition: string | null;
  sleeve_condition: string | null;
  seller_note: string | null;
  accept_offer: boolean;
  status: string;
  release: Release | Release[] | null;
};

const MEDIA_CONDITIONS = [
  "Mint (M)",
  "Near Mint (NM or M-)",
  "Very Good Plus (VG+)",
  "Very Good (VG)",
  "Good Plus (G+)",
  "Good (G)",
  "Fair (F)",
  "Poor (P)",
];

const SLEEVE_CONDITIONS = [
  "Mint (M)",
  "Near Mint (NM or M-)",
  "Very Good Plus (VG+)",
  "Very Good (VG)",
  "Good Plus (G+)",
  "Good (G)",
  "Fair (F)",
  "Poor (P)",
  "Generic",
  "No Cover",
];

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();

  const listingId = Number(params.listingId);

  const [listing, setListing] = useState<Listing | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [mediaCondition, setMediaCondition] =
    useState("");

  const [sleeveCondition, setSleeveCondition] =
    useState("");

  const [sellerNote, setSellerNote] =
    useState("");

  const [acceptOffer, setAcceptOffer] =
    useState(false);

  const [status, setStatus] =
    useState("for_sale");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    async function loadListing() {
      if (
        !Number.isInteger(listingId) ||
        listingId <= 0
      ) {
        setErrorMessage("Invalid listing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        /*
         * Identify the currently logged-in user.
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
            "You must be signed in to edit a listing.",
          );
        }

        /*
         * Find the seller account belonging to
         * the current user.
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
         * Load the listing.
         *
         * seller_id is included in the query so the page
         * only loads a listing owned by this seller.
         */
        const {
          data,
          error,
        } = await supabase
          .from("seller_listings")
          .select(`
            id,
            seller_id,
            release_id,
            price,
            quantity,
            media_condition,
            sleeve_condition,
            seller_note,
            accept_offer,
            status,

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
          .eq("id", listingId)
          .eq("seller_id", seller.id)
          .single();

        if (error || !data) {
          throw new Error(
            "Listing not found or you don't have permission to edit it.",
          );
        }

        const loadedListing =
          data as Listing;

        setListing(loadedListing);

        /*
         * Populate the form with the current values.
         */
        setPrice(
          String(loadedListing.price ?? ""),
        );

        setQuantity(
          String(loadedListing.quantity ?? 1),
        );

        setMediaCondition(
          loadedListing.media_condition ?? "",
        );

        setSleeveCondition(
          loadedListing.sleeve_condition ?? "",
        );

        setSellerNote(
          loadedListing.seller_note ?? "",
        );

        setAcceptOffer(
          Boolean(loadedListing.accept_offer),
        );

        setStatus(
          loadedListing.status ?? "for_sale",
        );
      } catch (error) {
        console.error(
          "Listing failed to load:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load this listing.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadListing();
  }, [listingId]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!listing) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setErrorMessage(
        "Enter a valid price greater than $0.",
      );
      return;
    }

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity < 0
    ) {
      setErrorMessage(
        "Quantity cannot be less than 0.",
      );
      return;
    }

    if (!mediaCondition) {
      setErrorMessage(
        "Select the media condition.",
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * RLS also protects this UPDATE at the
       * database level.
       */
      const {
        data,
        error,
      } = await supabase
        .from("seller_listings")
        .update({
          price: numericPrice,
          quantity: numericQuantity,
          media_condition: mediaCondition,
          sleeve_condition:
            sleeveCondition || null,
          seller_note:
            sellerNote.trim() || null,
          accept_offer: acceptOffer,
          status,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", listing.id)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "The listing could not be updated.",
        );
      }

      setSuccessMessage(
        "Your listing has been updated.",
      );

      /*
       * Refresh Next.js data so the homepage and
       * product page can show the new information.
       */
      router.refresh();
    } catch (error) {
      console.error(
        "Listing update failed:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your listing.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-gray-500">
          Loading listing...
        </p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-bold">
          Listing unavailable
        </h1>

        <p className="mt-4 text-gray-600">
          {errorMessage}
        </p>

        <Link
          href="/seller/listings"
          className="mt-6 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
        >
          Back to My Listings
        </Link>
      </main>
    );
  }

  const release = Array.isArray(
    listing.release,
  )
    ? listing.release[0]
    : listing.release;

  if (!release) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-bold">
          Release unavailable
        </h1>

        <Link
          href="/seller/listings"
          className="mt-6 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
        >
          Back to My Listings
        </Link>
      </main>
    );
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
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            Seller
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Edit Listing
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-gray-600">
            Update the condition, price, quantity,
            availability, and other details for your copy.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Release */}
          <section>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-gray-500">
              Release
            </p>

            <div className="relative aspect-square overflow-hidden bg-gray-100">
              {selectedImage ? (
                <Image
                  src={
                    selectedImage.image_url
                  }
                  alt={
                    release.artist
                      ? `${release.artist} - ${release.title}`
                      : release.title
                  }
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">
                  No artwork available
                </div>
              )}
            </div>

            <div className="mt-5">
              {release.artist && (
                <p className="text-lg text-gray-600">
                  {release.artist}
                </p>
              )}

              <h2 className="mt-1 text-3xl font-bold">
                {release.title}
              </h2>

              <div className="mt-4 space-y-1 text-sm text-gray-500">
                {release.format && (
                  <p>
                    Format: {release.format}
                  </p>
                )}

                {release.label && (
                  <p>
                    Label: {release.label}
                  </p>
                )}

                {release.catalog_number && (
                  <p>
                    Catalog:{" "}
                    {release.catalog_number}
                  </p>
                )}
              </div>

              <Link
                href={`/products/${listing.id}`}
                className="mt-5 inline-block text-sm underline"
              >
                View marketplace listing
              </Link>
            </div>
          </section>

          {/* Form */}
          <section>
            <form
              onSubmit={handleSubmit}
              className="border border-gray-200 p-6 md:p-8"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                Your Copy
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Listing Details
              </h2>

              {/* Status */}
              <div className="mt-8">
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium"
                >
                  Listing Status
                </label>

                <select
                  id="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value,
                    )
                  }
                  className="h-14 w-full border border-gray-300 bg-white px-4 outline-none focus:border-black"
                >
                  <option value="for_sale">
                    For Sale
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>

                  <option value="draft">
                    Draft
                  </option>
                </select>

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Use Inactive if you temporarily want
                  to remove this item from sale.
                </p>
              </div>

              {/* Media Condition */}
              <div className="mt-6">
                <label
                  htmlFor="media-condition"
                  className="mb-2 block text-sm font-medium"
                >
                  Media Condition
                </label>

                <select
                  id="media-condition"
                  value={mediaCondition}
                  onChange={(event) =>
                    setMediaCondition(
                      event.target.value,
                    )
                  }
                  required
                  className="h-14 w-full border border-gray-300 bg-white px-4 outline-none focus:border-black"
                >
                  <option value="">
                    Select condition
                  </option>

                  {MEDIA_CONDITIONS.map(
                    (condition) => (
                      <option
                        key={condition}
                        value={condition}
                      >
                        {condition}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* Sleeve Condition */}
              <div className="mt-6">
                <label
                  htmlFor="sleeve-condition"
                  className="mb-2 block text-sm font-medium"
                >
                  Sleeve Condition
                </label>

                <select
                  id="sleeve-condition"
                  value={sleeveCondition}
                  onChange={(event) =>
                    setSleeveCondition(
                      event.target.value,
                    )
                  }
                  className="h-14 w-full border border-gray-300 bg-white px-4 outline-none focus:border-black"
                >
                  <option value="">
                    Select condition
                  </option>

                  {SLEEVE_CONDITIONS.map(
                    (condition) => (
                      <option
                        key={condition}
                        value={condition}
                      >
                        {condition}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* Price + Quantity */}
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="price"
                    className="mb-2 block text-sm font-medium"
                  >
                    Price
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>

                    <input
                      id="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={price}
                      onChange={(event) =>
                        setPrice(
                          event.target.value,
                        )
                      }
                      required
                      className="h-14 w-full border border-gray-300 bg-white pl-8 pr-4 outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="quantity"
                    className="mb-2 block text-sm font-medium"
                  >
                    Quantity
                  </label>

                  <input
                    id="quantity"
                    type="number"
                    min="0"
                    step="1"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        event.target.value,
                      )
                    }
                    required
                    className="h-14 w-full border border-gray-300 bg-white px-4 outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Seller Notes */}
              <div className="mt-6">
                <label
                  htmlFor="seller-note"
                  className="mb-2 block text-sm font-medium"
                >
                  Seller Notes
                </label>

                <textarea
                  id="seller-note"
                  value={sellerNote}
                  onChange={(event) =>
                    setSellerNote(
                      event.target.value,
                    )
                  }
                  rows={5}
                  placeholder="Describe anything buyers should know about your copy..."
                  className="w-full resize-y border border-gray-300 bg-white p-4 outline-none focus:border-black"
                />
              </div>

              {/* Offers */}
              <label className="mt-6 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={acceptOffer}
                  onChange={(event) =>
                    setAcceptOffer(
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm">
                  I&apos;m willing to accept offers
                </span>
              </label>

              {/* Error */}
              {errorMessage && (
                <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {/* Success */}
              {successMessage && (
                <div className="mt-6 border border-gray-200 bg-gray-50 p-4 text-sm font-medium">
                  {successMessage}
                </div>
              )}

              {/* Actions */}
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <Link
                  href="/seller/listings"
                  className="inline-block border border-gray-300 px-6 py-3 transition hover:border-black"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}