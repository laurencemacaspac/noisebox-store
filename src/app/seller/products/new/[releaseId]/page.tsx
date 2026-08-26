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

export default function NewListingDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const releaseId = Number(params.releaseId);

  const [release, setRelease] = useState<Release | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [mediaCondition, setMediaCondition] = useState("");
  const [sleeveCondition, setSleeveCondition] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellerNote, setSellerNote] = useState("");
  const [acceptOffer, setAcceptOffer] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadRelease() {
      if (!Number.isInteger(releaseId) || releaseId <= 0) {
        setErrorMessage("Invalid release.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("releases")
        .select(`
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
        `)
        .eq("id", releaseId)
        .single();

      if (error || !data) {
        console.error(error);

        setErrorMessage(
          "We couldn't load the selected release.",
        );

        setLoading(false);
        return;
      }

      setRelease(data as Release);
      setLoading(false);
    }

    void loadRelease();
  }, [releaseId]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!release) {
      return;
    }

    setErrorMessage("");

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
      numericQuantity < 1
    ) {
      setErrorMessage(
        "Quantity must be at least 1.",
      );
      return;
    }

    if (!mediaCondition) {
      setErrorMessage(
        "Select the media condition.",
      );
      return;
    }

    setSubmitting(true);

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
          "You must be signed in to list an item.",
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
        .select("id, shop_name")
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
       * Create ONLY the seller listing.
       *
       * The release itself already exists, so we do not
       * duplicate release information or artwork.
       */
      const {
        data: newListing,
        error: listingError,
      } = await supabase
        .from("seller_listings")
        .insert({
          release_id: release.id,
          seller_id: seller.id,
          price: numericPrice,
          quantity: numericQuantity,
          media_condition: mediaCondition,
          sleeve_condition:
            sleeveCondition || null,
          seller_note:
            sellerNote.trim() || null,
          accept_offer: acceptOffer,
          status: "for_sale",
          source: "manual",
        })
        .select("id")
        .single();

      if (listingError) {
        throw listingError;
      }

      if (!newListing) {
        throw new Error(
          "The listing was created, but its ID could not be returned.",
        );
      }

      /*
       * Send the seller to the new marketplace listing.
       */
      router.push(`/products/${newListing.id}`);
      router.refresh();
    } catch (error) {
      console.error("Listing creation failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create your listing.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-gray-500">
          Loading release...
        </p>
      </main>
    );
  }

  if (!release) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-bold">
          Release unavailable
        </h1>

        <p className="mt-4 text-gray-600">
          {errorMessage}
        </p>

        <Link
          href="/seller/products/new"
          className="mt-6 inline-block underline"
        >
          Return to release search
        </Link>
      </main>
    );
  }

  const images = [...(release.release_images ?? [])].sort(
    (a, b) =>
      (a.sort_order ?? 0) -
      (b.sort_order ?? 0),
  );

  const primaryImage = images.find(
    (image) => image.is_primary,
  );

  const frontImage = images.find(
    (image) => image.image_type === "front",
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
            List Your Copy
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-gray-600">
            The release information and artwork are shared.
            Tell buyers about the specific copy you&apos;re
            selling.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Selected Release */}
          <section>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-gray-500">
              Selected Release
            </p>

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
                    Catalog: {release.catalog_number}
                  </p>
                )}
              </div>

              <Link
                href="/seller/products/new"
                className="mt-5 inline-block text-sm underline"
              >
                Choose a different release
              </Link>
            </div>
          </section>

          {/* Seller Listing Form */}
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

              {/* Media Condition */}
              <div className="mt-8">
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
                        setPrice(event.target.value)
                      }
                      placeholder="0.00"
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
                    min="1"
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

                <p className="mt-2 text-xs text-gray-500">
                  Use this for details not covered by the
                  condition grade, such as light marks,
                  writing, stickers, or sleeve wear.
                </p>
              </div>

              {/* Accept Offers */}
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

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="mt-8 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {submitting
                  ? "Listing Item..."
                  : "List Item"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}