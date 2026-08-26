"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SellerSetupPage() {
  const router = useRouter();

  const [shopName, setShopName] =
    useState("");

  const [shopSlug, setShopSlug] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
   * Make sure:
   *
   * 1. The visitor is logged in.
   * 2. They do not already have a seller profile.
   */
  useEffect(() => {
    async function checkSeller() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          router.replace("/");
          return;
        }

        const {
          data: existingSeller,
          error: sellerError,
        } = await supabase
          .from("sellers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (sellerError) {
          throw sellerError;
        }

        /*
         * Existing sellers don't need setup again.
         */
        if (existingSeller) {
          router.replace("/seller");
          return;
        }
      } catch (error) {
        console.error(
          "Seller setup check failed:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load seller setup.",
        );
      } finally {
        setLoading(false);
      }
    }

    void checkSeller();
  }, [router]);

  /*
   * Automatically create a URL-safe shop slug
   * from the shop name.
   *
   * Example:
   *
   * Test Records
   *      ↓
   * test-records
   */
  function handleShopNameChange(
    value: string,
  ) {
    setShopName(value);

    const generatedSlug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    setShopSlug(generatedSlug);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");

    const cleanShopName =
      shopName.trim();

    const cleanShopSlug =
      shopSlug.trim();

    if (!cleanShopName) {
      setErrorMessage(
        "Please enter a shop name.",
      );

      return;
    }

    if (!cleanShopSlug) {
      setErrorMessage(
        "Please enter a valid shop name.",
      );

      return;
    }

    setSubmitting(true);

    try {
      /*
       * Get the authenticated Noisebox account.
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
          "You must be signed in to start selling.",
        );
      }

      /*
       * Check again before inserting.
       *
       * This prevents accidentally creating
       * multiple seller profiles for one account.
       */
      const {
        data: existingSeller,
        error: existingSellerError,
      } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingSellerError) {
        throw existingSellerError;
      }

      if (existingSeller) {
        router.push("/seller");
        router.refresh();
        return;
      }

      /*
       * Make sure another seller isn't already
       * using this shop URL.
       */
      const {
        data: slugOwner,
        error: slugError,
      } = await supabase
        .from("sellers")
        .select("id")
        .eq("shop_slug", cleanShopSlug)
        .maybeSingle();

      if (slugError) {
        throw slugError;
      }

      if (slugOwner) {
        throw new Error(
          "That shop name is already being used. Please choose another.",
        );
      }

      /*
       * Activate selling for this Noisebox account.
       *
       * This is the moment the buyer/general
       * account becomes a seller too.
       */
      const {
        error: insertError,
      } = await supabase
        .from("sellers")
        .insert({
          user_id: user.id,
          shop_name: cleanShopName,
          shop_slug: cleanShopSlug,
          description:
            description.trim() || null,
        });

      if (insertError) {
        throw insertError;
      }

      /*
       * Seller profile successfully created.
       */
      router.push("/seller");
      router.refresh();
    } catch (error) {
      console.error(
        "Seller setup failed:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create your seller account.",
      );

      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-gray-500">
            Loading seller setup...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
          Sell on Noisebox
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Create Your Store
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-gray-600">
          Set up your seller profile. You will
          continue using the same Noisebox account
          for both buying and selling.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-7"
        >
          {/* Shop Name */}
          <div>
            <label
              htmlFor="shop-name"
              className="mb-2 block text-sm font-medium"
            >
              Shop Name
            </label>

            <input
              id="shop-name"
              type="text"
              required
              value={shopName}
              onChange={(event) =>
                handleShopNameChange(
                  event.target.value,
                )
              }
              placeholder="Test Records"
              className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />

            <p className="mt-2 text-sm text-gray-500">
              This is the name buyers will see
              throughout the marketplace.
            </p>
          </div>

          {/* Shop URL */}
          <div>
            <label
              htmlFor="shop-slug"
              className="mb-2 block text-sm font-medium"
            >
              Shop URL
            </label>

            <div className="flex border border-gray-300 focus-within:border-black">
              <span className="flex items-center border-r border-gray-300 bg-gray-50 px-4 text-sm text-gray-500">
                /seller/
              </span>

              <input
                id="shop-slug"
                type="text"
                required
                value={shopSlug}
                onChange={(event) => {
                  const value =
                    event.target.value
                      .toLowerCase()
                      .replace(
                        /[^a-z0-9-]/g,
                        "",
                      );

                  setShopSlug(value);
                }}
                placeholder="test-records"
                className="min-w-0 flex-1 px-4 py-3 outline-none"
              />
            </div>

            <p className="mt-2 text-sm text-gray-500">
              We'll automatically create this from
              your shop name, but you can change it.
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium"
            >
              Shop Description
              <span className="ml-1 font-normal text-gray-400">
                (optional)
              </span>
            </label>

            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="Tell buyers a little about your store and the music you sell."
              className="w-full resize-none border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Submit */}
          <div className="border-t border-gray-200 pt-7">
            <button
              type="submit"
              disabled={submitting}
              className="bg-black px-7 py-4 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {submitting
                ? "Creating Store..."
                : "Create Store"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}