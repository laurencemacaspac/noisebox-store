"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  status: string;
  subtotal: number;
  shipping_total: number;
  total: number;
  currency: string;
  created_at: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  artist: string | null;
  title: string;
  format: string | null;
  media_condition: string | null;
  sleeve_condition: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  fulfillment_status: string;
  tracking_number: string | null;
  shipping_carrier: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};

type Purchase = Order & {
  items: OrderItem[];
};

function formatMoney(
  amount: number,
  currency: string,
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Number(amount));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export default function PurchaseHistoryPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [purchases, setPurchases] = useState<
    Purchase[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState<
    string | null
  >(null);

  useEffect(() => {
    let mounted = true;

    async function loadPurchases() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (userError) {
        console.error(
          "Purchase history user error:",
          userError,
        );

        setError(
          "Unable to load your account.",
        );

        setLoading(false);
        return;
      }

      setUser(user);

      if (!user) {
        setPurchases([]);
        setLoading(false);
        return;
      }

      /*
       * Only retrieve orders belonging to the
       * currently logged-in buyer.
       *
       * buyer_id is the Supabase Auth UUID.
       */
      const {
        data: ordersData,
        error: ordersError,
      } = await supabase
        .from("orders")
        .select(
          `
          id,
          status,
          subtotal,
          shipping_total,
          total,
          currency,
          created_at
        `,
        )
        .eq("buyer_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (!mounted) {
        return;
      }

      if (ordersError) {
        console.error(
          "Purchase history orders error:",
          ordersError,
        );

        setError(
          "Unable to load your purchases.",
        );

        setLoading(false);
        return;
      }

      const orders =
        (ordersData ?? []) as Order[];

      /*
       * If the buyer hasn't purchased anything,
       * there is no reason to query order_items.
       */
      if (orders.length === 0) {
        setPurchases([]);
        setLoading(false);
        return;
      }

      const orderIds = orders.map(
        (order) => order.id,
      );

      const {
        data: itemsData,
        error: itemsError,
      } = await supabase
        .from("order_items")
        .select(
          `
          id,
          order_id,
          artist,
          title,
          format,
          media_condition,
          sleeve_condition,
          quantity,
          unit_price,
          line_total,
          fulfillment_status,
          tracking_number,
          shipping_carrier,
          shipped_at,
          delivered_at
        `,
        )
        .in("order_id", orderIds)
        .order("id", {
          ascending: true,
        });

      if (!mounted) {
        return;
      }

      if (itemsError) {
        console.error(
          "Purchase history items error:",
          itemsError,
        );

        setError(
          "Unable to load the items in your purchases.",
        );

        setLoading(false);
        return;
      }

      const items =
        (itemsData ?? []) as OrderItem[];

      /*
       * Attach each order's items to its order.
       */
      const purchaseData: Purchase[] =
        orders.map((order) => ({
          ...order,

          items: items.filter(
            (item) =>
              item.order_id === order.id,
          ),
        }));

      setPurchases(purchaseData);
      setLoading(false);
    }

    loadPurchases();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      () => {
        loadPurchases();
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
          Loading purchases...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Account
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Purchase History
          </h1>

          <p className="mt-4 text-lg leading-8 text-gray-600">
            Sign in to view your Noisebox
            purchases.
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex border border-black px-6 py-3 font-medium transition hover:bg-black hover:text-white"
          >
            Back to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <Link
          href="/account"
          className="text-sm text-gray-500 transition hover:text-black"
        >
          ← Back to Account
        </Link>

        <p className="mt-7 text-sm font-semibold uppercase tracking-widest text-gray-500">
          Buying
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Purchase History
        </h1>

        <p className="mt-3 text-gray-600">
          View your Noisebox purchases and
          shipping progress.
        </p>
      </div>

      {error && (
        <div className="mb-8 border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {!error &&
        purchases.length === 0 && (
          <div className="border border-gray-200 bg-white p-8">
            <h2 className="text-xl font-semibold">
              No purchases yet
            </h2>

            <p className="mt-2 text-gray-600">
              Items you purchase on Noisebox
              will appear here.
            </p>

            <Link
              href="/#shop"
              className="mt-6 inline-flex bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800"
            >
              Browse Shop
            </Link>
          </div>
        )}

      {!error &&
        purchases.length > 0 && (
          <div className="space-y-6">
            {purchases.map((purchase) => (
              <section
                key={purchase.id}
                className="border border-gray-200 bg-white"
              >
                <div className="flex flex-col gap-4 border-b border-gray-200 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Order #{purchase.id}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {formatDate(
                        purchase.created_at,
                      )}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-sm text-gray-500">
                      Payment Status
                    </p>

                    <p className="font-semibold">
                      {formatStatus(
                        purchase.status,
                      )}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {purchase.items.map(
                    (item) => (
                      <div
                        key={item.id}
                        className="p-6"
                      >
                        <div className="flex flex-col gap-5 sm:flex-row sm:justify-between">
                          <div>
                            <h2 className="text-lg font-semibold">
                              {item.artist
                                ? `${item.artist} — ${item.title}`
                                : item.title}
                            </h2>

                            <div className="mt-3 space-y-1 text-sm text-gray-600">
                              {item.format && (
                                <p>
                                  Format:{" "}
                                  {item.format}
                                </p>
                              )}

                              {item.media_condition && (
                                <p>
                                  Media
                                  condition:{" "}
                                  {
                                    item.media_condition
                                  }
                                </p>
                              )}

                              {item.sleeve_condition && (
                                <p>
                                  Sleeve
                                  condition:{" "}
                                  {
                                    item.sleeve_condition
                                  }
                                </p>
                              )}

                              <p>
                                Quantity:{" "}
                                {item.quantity}
                              </p>
                            </div>
                          </div>

                          <div className="sm:text-right">
                            <p className="text-lg font-semibold">
                              {formatMoney(
                                item.line_total,
                                purchase.currency,
                              )}
                            </p>

                            <p className="mt-2 text-sm text-gray-500">
                              {formatStatus(
                                item.fulfillment_status,
                              )}
                            </p>
                          </div>
                        </div>

                        {item.tracking_number && (
                          <div className="mt-5 border-t border-gray-100 pt-5">
                            <p className="text-sm font-semibold">
                              Tracking
                            </p>

                            <p className="mt-1 text-sm text-gray-600">
                              {item.shipping_carrier
                                ? `${item.shipping_carrier}: `
                                : ""}
                              {
                                item.tracking_number
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>

                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  <div className="ml-auto max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between gap-6">
                      <span className="text-gray-600">
                        Merchandise
                      </span>

                      <span>
                        {formatMoney(
                          purchase.subtotal,
                          purchase.currency,
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between gap-6">
                      <span className="text-gray-600">
                        Shipping
                      </span>

                      <span>
                        {formatMoney(
                          purchase.shipping_total,
                          purchase.currency,
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between gap-6 border-t border-gray-300 pt-3 text-base font-semibold">
                      <span>Total</span>

                      <span>
                        {formatMoney(
                          purchase.total,
                          purchase.currency,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
    </main>
  );
}