"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabase";

type Seller = {
  id: number;
  shop_name: string;
  shop_slug: string;
};

type Order = {
  id: number;
  status: string;
  buyer_email: string | null;
  shipping_name: string | null;
  created_at: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  listing_id: number;
  seller_id: number;
  artist: string | null;
  title: string;
  format: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  fulfillment_status: string;
  orders: Order | Order[] | null;
};

type SellerOrdersResponse = {
  seller?: Seller;
  orderItems?: OrderItem[];
  error?: string;
};

export default function SellerOrdersPage() {
  const [seller, setSeller] =
    useState<Seller | null>(null);

  const [orderItems, setOrderItems] =
    useState<OrderItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [notSignedIn, setNotSignedIn] =
    useState(false);

  const [notSeller, setNotSeller] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      setNotSignedIn(false);
      setNotSeller(false);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (
        sessionError ||
        !session?.access_token
      ) {
        setSeller(null);
        setOrderItems([]);
        setNotSignedIn(true);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          "/api/seller/orders",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as SellerOrdersResponse;

        if (!mounted) {
          return;
        }

        if (response.status === 401) {
          setSeller(null);
          setOrderItems([]);
          setNotSignedIn(true);
          setLoading(false);
          return;
        }

        if (response.status === 403) {
          setSeller(null);
          setOrderItems([]);
          setNotSeller(true);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(
            result.error ??
              `Unable to load seller orders (${response.status}).`,
          );
        }

        if (!result.seller) {
          throw new Error(
            "The server returned incomplete seller data.",
          );
        }

        setSeller(result.seller);
        setOrderItems(
          result.orderItems ?? [],
        );

        setLoading(false);
      } catch (loadError) {
        console.error(
          "Seller orders load error:",
          loadError,
        );

        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load seller orders.",
        );

        setSeller(null);
        setOrderItems([]);
        setLoading(false);
      }
    }

    void loadOrders();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      () => {
        void loadOrders();
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-gray-500">
          Loading seller orders...
        </p>
      </main>
    );
  }

  if (notSignedIn) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          Selling
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Seller Orders
        </h1>

        <p className="mt-4 max-w-xl text-gray-600">
          Sign in to a seller account to view
          orders.
        </p>

        <Link
          href="/"
          className="mt-7 inline-flex border border-black px-5 py-2.5 text-sm font-medium transition hover:bg-black hover:text-white"
        >
          Back to Shop
        </Link>
      </main>
    );
  }

  if (notSeller) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          Selling
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          You don&apos;t have a seller shop yet.
        </h1>

        <p className="mt-4 max-w-xl text-gray-600">
          Open a Noisebox shop before you can
          receive and manage seller orders.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/seller"
            className="inline-flex bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Start Selling
          </Link>

          <Link
            href="/account"
            className="inline-flex border border-gray-300 px-5 py-2.5 text-sm font-medium transition hover:border-black"
          >
            Back to Account
          </Link>
        </div>
      </main>
    );
  }

  if (error || !seller) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-red-600">
          {error ??
            "Unable to load seller orders."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-gray-500">
          {seller.shop_name}
        </p>

        <h1 className="text-3xl font-bold">
          Orders
        </h1>

        <p className="mt-2 text-gray-600">
          Manage orders and track shipments.
        </p>

        <nav className="mt-7 flex gap-8 border-b border-gray-200">
          <Link
            href="/seller/orders"
            className="border-b-2 border-black pb-3 text-sm font-semibold text-black"
          >
            Orders to Ship
          </Link>

          <Link
            href="/seller/orders/history"
            className="pb-3 text-sm font-medium text-gray-500 transition hover:text-black"
          >
            Order History
          </Link>
        </nav>
      </div>

      <h2 className="mb-5 text-xl font-semibold">
        Orders to Ship
      </h2>

      {orderItems.length === 0 ? (
        <div className="border border-gray-200 p-8">
          <p className="text-gray-600">
            You don&apos;t have any orders to
            ship.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orderItems.map((item) => {
            const order =
              Array.isArray(item.orders)
                ? item.orders[0] ?? null
                : item.orders;

            const orderDate =
              order?.created_at
                ? new Intl.DateTimeFormat(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  ).format(
                    new Date(
                      order.created_at,
                    ),
                  )
                : "";

            const statusLabel =
              item.fulfillment_status ===
              "needs_shipping"
                ? "Needs Shipping"
                : item.fulfillment_status.replaceAll(
                    "_",
                    " ",
                  );

            return (
              <div
                key={item.id}
                className="border border-gray-200 bg-white p-6"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Order #{item.order_id}
                      </span>

                      {orderDate && (
                        <span className="text-sm text-gray-500">
                          {orderDate}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold">
                      {item.artist
                        ? `${item.artist} — ${item.title}`
                        : item.title}
                    </h3>

                    <div className="mt-3 space-y-1 text-sm text-gray-600">
                      {item.format && (
                        <p>
                          Format: {item.format}
                        </p>
                      )}

                      <p>
                        Quantity: {item.quantity}
                      </p>

                      <div className="pt-2">
                        <p>
                          <span className="font-medium text-gray-900">
                            Buyer:
                          </span>{" "}
                          {order?.shipping_name ??
                            "Name not available"}
                        </p>

                        <p>
                          <span className="font-medium text-gray-900">
                            Email:
                          </span>{" "}
                          {order?.buyer_email ??
                            "Email not available"}
                        </p>
                      </div>

                      <p className="pt-2">
                        <span className="font-medium text-gray-900">
                          Status:
                        </span>{" "}
                        {statusLabel}
                      </p>
                    </div>
                  </div>

                  <div className="md:text-right">
                    <p className="text-xl font-semibold">
                      $
                      {Number(
                        item.line_total,
                      ).toFixed(2)}
                    </p>

                    <Link
                      href={`/seller/orders/${item.order_id}`}
                      className="mt-4 inline-flex min-w-32 items-center justify-center border border-black px-5 py-2.5 text-sm font-medium text-black transition hover:bg-black hover:text-white"
                    >
                      View Order
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}