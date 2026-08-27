"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type Seller = {
  id: number;
  user_id: string;
  shop_name: string;
  shop_slug: string;
  description: string | null;
};

type SellerListing = {
  id: number;
};

export default function SellerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [seller, setSeller] =
    useState<Seller | null>(null);

  const [listingCount, setListingCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSeller() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      setUser(user);

      if (!user) {
        setSeller(null);
        setListingCount(0);
        setLoading(false);
        return;
      }

      const {
        data: sellerData,
        error: sellerError,
      } = await supabase
        .from("sellers")
        .select(`
          id,
          user_id,
          shop_name,
          shop_slug,
          description
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      if (sellerError) {
        console.error(
          "Seller lookup error:",
          sellerError,
        );

        setSeller(null);
        setListingCount(0);
        setLoading(false);
        return;
      }

      if (!sellerData) {
        setSeller(null);
        setListingCount(0);
        setLoading(false);
        return;
      }

      const currentSeller =
        sellerData as Seller;

      setSeller(currentSeller);

      const {
        data: listings,
        error: listingsError,
      } = await supabase
        .from("seller_listings")
        .select("id")
        .eq(
          "seller_id",
          currentSeller.id,
        );

      if (!mounted) {
        return;
      }

      if (listingsError) {
        console.error(
          "Seller listings lookup error:",
          listingsError,
        );

        setListingCount(0);
      } else {
        setListingCount(
          (
            (listings ??
              []) as SellerListing[]
          ).length,
        );
      }

      setLoading(false);
    }

    loadSeller();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        () => {
          loadSeller();
        },
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-gray-500">
          Loading...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">
            Sell on Noisebox
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Turn your collection into a
            storefront.
          </h1>

          <p className="mt-5 text-lg leading-8 text-gray-600">
            Sign in or create an account to
            start selling records, CDs,
            merchandise, and more on
            Noisebox.
          </p>

          <Link
            href="/register"
            className="mt-8 inline-flex bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800"
          >
            Create Account
          </Link>
        </div>
      </main>
    );
  }

  /*
   * Logged-in user who has never created
   * a seller account.
   */
  if (!seller) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <p className="text-sm text-gray-500">
            Signed in as {user.email}
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Start Selling
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-600">
            Create your Noisebox shop and
            start selling records, CDs,
            shirts, posters, and other music
            merchandise.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="border border-gray-200 bg-white p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              Selling
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Open your shop
            </h2>

            <p className="mt-3 leading-7 text-gray-600">
              Set up your seller profile,
              choose your shop name, and list
              your first item.
            </p>

            <Link
              href="/seller/setup"
              className="mt-6 inline-flex bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800"
            >
              Start Selling
            </Link>
          </section>

          <section className="border border-gray-200 bg-white p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              Buying
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Your Purchases
            </h2>

            <p className="mt-3 leading-7 text-gray-600">
              View items you&apos;ve
              purchased, shipping progress,
              and your order history.
            </p>

            <div className="mt-6 inline-flex cursor-not-allowed border border-gray-300 px-6 py-3 font-medium text-gray-400">
              Purchase History

              <span className="ml-2 text-xs">
                Coming Soon
              </span>
            </div>
          </section>
        </div>
      </main>
    );
  }

  /*
   * Seller exists but has not listed
   * anything yet.
   */
  if (listingCount === 0) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            {seller.shop_name}
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Your shop is ready.
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-600">
            Add your first record, CD, or
            piece of merchandise to start
            selling on Noisebox.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {/*
             * Single-item workflow:
             * Search the existing Noisebox
             * release catalog first.
             */}
            <Link
              href="/seller/products/new"
              className="inline-flex bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800"
            >
              List Your First Item
            </Link>

            {/*
             * Bulk Discogs CSV import stays
             * available as a separate option.
             */}
            <Link
              href="/seller/import"
              className="inline-flex border border-gray-300 px-6 py-3 font-medium text-black transition hover:border-black"
            >
              Import Inventory
            </Link>

            <Link
              href="/seller/setup"
              className="inline-flex border border-gray-300 px-6 py-3 font-medium text-black transition hover:border-black"
            >
              Shop Settings
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /*
   * Established seller dashboard.
   */
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          {seller.shop_name}
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Seller Dashboard
        </h1>

        <p className="mt-3 text-gray-600">
          Manage your shop, listings,
          orders, and selling activity.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* LIST SINGLE ITEM */}
        <Link
          href="/seller/products/new"
          className="border border-gray-200 bg-white p-6 transition hover:border-black"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Sell
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            List an Item
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Search for a release or create a
            new listing.
          </p>
        </Link>

        {/* INVENTORY */}
        <Link
          href="/seller/listings"
          className="border border-gray-200 bg-white p-6 transition hover:border-black"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Inventory
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Listings
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Manage your {listingCount} active{" "}
            {listingCount === 1
              ? "listing"
              : "listings"}
            .
          </p>
        </Link>

        {/* BULK IMPORT */}
        <Link
          href="/seller/import"
          className="border border-gray-200 bg-white p-6 transition hover:border-black"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Import
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Import Inventory
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Add multiple listings from your
            Discogs inventory CSV.
          </p>
        </Link>

        {/* ORDERS TO SHIP */}
        <Link
          href="/seller/orders"
          className="border border-gray-200 bg-white p-6 transition hover:border-black"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Fulfillment
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Orders to Ship
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            View paid orders that need to be
            packaged and shipped.
          </p>
        </Link>

        {/* ORDER HISTORY */}
        <Link
          href="/seller/orders/history"
          className="border border-gray-200 bg-white p-6 transition hover:border-black"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Sales
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Order History
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Review previously shipped and
            completed orders.
          </p>
        </Link>

        {/* FEEDBACK */}
        <div className="cursor-not-allowed border border-gray-200 bg-gray-50 p-6 opacity-60">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Reputation
          </p>

          <h2 className="mt-2 text-xl font-semibold text-gray-500">
            Feedback
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            Buyer ratings and seller
            feedback.
          </p>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Coming Soon
          </p>
        </div>

        {/* SETTINGS */}
        <Link
          href="/seller/setup"
          className="border border-gray-200 bg-white p-6 transition hover:border-black"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Account
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Shop Settings
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Update your shop information and
            seller settings.
          </p>
        </Link>
      </div>
    </main>
  );
}