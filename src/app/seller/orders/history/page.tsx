"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  getSellerAuth,
  type SellerAccount,
} from "@/lib/sellerAuth";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  status: string;
  buyer_email: string | null;
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
  tracking_number: string | null;
  shipping_carrier: string | null;
  shipped_at: string | null;

  /*
   * Supabase may represent this relationship
   * as either an object or an array depending
   * on relationship inference.
   */
  orders: Order | Order[] | null;
};

export default function SellerOrderHistoryPage() {
  const [seller, setSeller] =
    useState<SellerAccount | null>(null);

  const [orderItems, setOrderItems] =
    useState<OrderItem[]>([]);

  const [signedIn, setSignedIn] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadOrderHistory() {
      setLoading(true);
      setError(null);

      /*
       * Determine the seller from the currently
       * authenticated Supabase user.
       *
       * No hard-coded seller ID is used.
       */
      const {
        user,
        seller: authenticatedSeller,
      } = await getSellerAuth();

      if (!mounted) {
        return;
      }

      setSignedIn(Boolean(user));
      setSeller(authenticatedSeller);

      /*
       * Do not query seller order data unless
       * the logged-in account actually owns
       * a seller record.
       */
      if (!user || !authenticatedSeller) {
        setOrderItems([]);
        setLoading(false);
        return;
      }

      const {
        data,
        error: historyError,
      } = await supabase
        .from("order_items")
        .select(
          `
          id,
          order_id,
          listing_id,
          seller_id,
          artist,
          title,
          format,
          quantity,
          unit_price,
          line_total,
          fulfillment_status,
          tracking_number,
          shipping_carrier,
          shipped_at,

          orders!order_items_order_id_fkey (
            id,
            status,
            buyer_email,
            created_at
          )
        `,
        )
        .eq(
          "seller_id",
          authenticatedSeller.id,
        )
        .eq(
          "fulfillment_status",
          "shipped",
        )
        .order("id", {
          ascending: false,
        });

      if (!mounted) {
        return;
      }

      if (historyError) {
        console.error(
          "Seller order history error:",
          historyError,
        );

        setError(
          "Unable to load order history.",
        );

        setOrderItems([]);
        setLoading(false);
        return;
      }

      setOrderItems(
        (data ?? []) as unknown as OrderItem[],
      );

      setLoading(false);
    }

    void loadOrderHistory();

    /*
     * Reload if the authentication state changes
     * while the page is open.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      () => {
        void loadOrderHistory();
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
          Loading order history...
        </p>
      </main>
    );
  }

  /*
   * Not signed in.
   */
  if (!signedIn) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          Selling
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Seller Order History
        </h1>

        <p className="mt-4 max-w-xl text-gray-600">
          Sign in to a seller account to view
          order history.
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

  /*
   * Signed in, but this account is not a seller.
   */
  if (!seller) {
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
          access seller order history.
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
            className="pb-3 text-sm font-medium text-gray-500 transition hover:text-black"
          >
            Orders to Ship
          </Link>

          <Link
            href="/seller/orders/history"
            className="border-b-2 border-black pb-3 text-sm font-semibold text-black"
          >
            Order History
          </Link>
        </nav>
      </div>

      <h2 className="mb-5 text-xl font-semibold">
        Order History
      </h2>

      {error && (
        <div className="mb-6 border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {!error && orderItems.length === 0 ? (
        <div className="border border-gray-200 p-8">
          <p className="text-gray-600">
            You don&apos;t have any shipped
            orders yet.
          </p>
        </div>
      ) : (
        !error && (
          <div className="space-y-4">
            {orderItems.map((item) => {
              const order = Array.isArray(
                item.orders,
              )
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

              const shippedDate =
                item.shipped_at
                  ? new Intl.DateTimeFormat(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    ).format(
                      new Date(
                        item.shipped_at,
                      ),
                    )
                  : null;

              return (
                <div
                  key={item.id}
                  className="border border-gray-200 bg-white p-6"
                >
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          Order #
                          {item.order_id}
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
                            Format:{" "}
                            {item.format}
                          </p>
                        )}

                        <p>
                          Quantity:{" "}
                          {item.quantity}
                        </p>

                        <p>
                          Buyer:{" "}
                          {order?.buyer_email ??
                            "Not available"}
                        </p>

                        {shippedDate && (
                          <p>
                            Shipped:{" "}
                            {shippedDate}
                          </p>
                        )}

                        {item.shipping_carrier && (
                          <p>
                            Carrier:{" "}
                            {
                              item.shipping_carrier
                            }
                          </p>
                        )}

                        {item.tracking_number && (
                          <p>
                            Tracking:{" "}
                            {
                              item.tracking_number
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="md:text-right">
                      <p className="text-xl font-semibold">
                        $
                        {Number(
                          item.line_total,
                        ).toFixed(2)}
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        Shipped
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
        )
      )}
    </main>
  );
}