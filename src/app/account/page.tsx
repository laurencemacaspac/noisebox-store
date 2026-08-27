"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type Seller = {
  id: number;
  shop_name: string;
};

export default function AccountPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [seller, setSeller] =
    useState<Seller | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (userError) {
        console.error(
          "Account user error:",
          userError,
        );

        setUser(null);
        setSeller(null);
        setLoading(false);
        return;
      }

      setUser(user);

      if (!user) {
        setSeller(null);
        setLoading(false);
        return;
      }

      /*
       * Every Noisebox account can buy.
       *
       * A user becomes a seller only when their
       * Supabase Auth UUID exists in sellers.user_id.
       */
      const {
        data: sellerData,
        error: sellerError,
      } = await supabase
        .from("sellers")
        .select(
          `
          id,
          shop_name
        `,
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      if (sellerError) {
        console.error(
          "Account seller lookup error:",
          sellerError,
        );

        setSeller(null);
      } else {
        setSeller(
          sellerData as Seller | null,
        );
      }

      setLoading(false);
    }

    loadAccount();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      () => {
        loadAccount();
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-gray-500">
          Loading account...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Noisebox
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Your Account
          </h1>

          <p className="mt-4 text-lg leading-8 text-gray-600">
            Sign in to view your purchases,
            manage your account, or start
            selling on Noisebox.
          </p>

          <Link
            href="/register"
            className="mt-7 inline-flex bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800"
          >
            Create Account
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <p className="text-sm text-gray-500">
          Signed in as {user.email}
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Account
        </h1>

        <p className="mt-3 max-w-2xl text-gray-600">
          Manage your Noisebox purchases and
          selling activity.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* PURCHASES */}
        <Link
          href="/account/purchases"
          className="border border-gray-200 bg-white p-8 transition hover:border-black"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Buying
          </p>

          <h2 className="mt-3 text-2xl font-semibold">
            Your Purchases
          </h2>

          <p className="mt-3 leading-7 text-gray-600">
            View your purchase history,
            payment status, and shipping
            progress.
          </p>

          <p className="mt-6 text-sm font-semibold">
            View Purchase History →
          </p>
        </Link>

        {/* SELLING */}
        {seller ? (
          <Link
            href="/seller"
            className="border border-gray-200 bg-white p-8 transition hover:border-black"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              Selling
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Seller Dashboard
            </h2>

            <p className="mt-3 leading-7 text-gray-600">
              Manage {seller.shop_name},
              listings, orders, and
              fulfillment.
            </p>

            <p className="mt-6 text-sm font-semibold">
              Go to Seller Dashboard →
            </p>
          </Link>
        ) : (
          <Link
            href="/seller"
            className="border border-gray-200 bg-white p-8 transition hover:border-black"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              Selling
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Start Selling
            </h2>

            <p className="mt-3 leading-7 text-gray-600">
              Open your Noisebox shop and
              start selling records, CDs,
              shirts, posters, and more.
            </p>

            <p className="mt-6 text-sm font-semibold">
              Start Selling →
            </p>
          </Link>
        )}

        {/* ACCOUNT SETTINGS */}
        <div className="cursor-not-allowed border border-gray-200 bg-gray-50 p-8 opacity-60">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Profile
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-gray-500">
            Account Settings
          </h2>

          <p className="mt-3 leading-7 text-gray-400">
            Manage your profile, contact
            information, and account
            preferences.
          </p>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Coming Soon
          </p>
        </div>
      </div>
    </main>
  );
}