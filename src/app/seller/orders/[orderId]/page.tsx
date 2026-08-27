"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

import MarkAsShippedButton from "@/components/MarkAsShippedButton";
import { supabase } from "@/lib/supabase";

type Seller = {
  id: number;
  shop_name: string;
  shop_slug: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  listing_id: number;
  seller_id: number;
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
};

type ShippingHub = {
  id: number;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country_code: string;
};

type Order = {
  id: number;
  status: string;
  buyer_email: string | null;

  shipping_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;

  subtotal: number;
  shipping_total: number;
  seller_shipping_total: number;
  hub_shipping_total: number;
  shipping_method: string | null;
  shipping_hub_id: number | null;
  total: number;
  currency: string;
  created_at: string;
};

type OrderResponse = {
  seller?: Seller;
  order?: Order;
  orderItems?: OrderItem[];
  shippingHub?: ShippingHub | null;
  error?: string;
};

export default function SellerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const numericOrderId = Number(params.orderId);

  const [seller, setSeller] =
    useState<Seller | null>(null);

  const [order, setOrder] =
    useState<Order | null>(null);

  const [orderItems, setOrderItems] =
    useState<OrderItem[]>([]);

  const [shippingHub, setShippingHub] =
    useState<ShippingHub | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [notAllowed, setNotAllowed] =
    useState(false);

  const [notSignedIn, setNotSignedIn] =
    useState(false);

  const [notSeller, setNotSeller] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadOrder() {
      setLoading(true);
      setError(null);
      setNotAllowed(false);
      setNotSignedIn(false);
      setNotSeller(false);

      if (
        !Number.isInteger(numericOrderId) ||
        numericOrderId <= 0
      ) {
        if (mounted) {
          setNotAllowed(true);
          setLoading(false);
        }

        return;
      }

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
        setNotSignedIn(true);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/seller/orders/${encodeURIComponent(
            String(numericOrderId),
          )}`,
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
          (await response.json()) as OrderResponse;

        if (!mounted) {
          return;
        }

        if (response.status === 401) {
          setNotSignedIn(true);
          setLoading(false);
          return;
        }

        if (response.status === 403) {
          setNotSeller(true);
          setLoading(false);
          return;
        }

        if (response.status === 404) {
          setNotAllowed(true);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(
            result.error ??
              `Unable to load order (${response.status}).`,
          );
        }

        if (
          !result.seller ||
          !result.order ||
          !result.orderItems
        ) {
          throw new Error(
            "The server returned incomplete order data.",
          );
        }

        setSeller(result.seller);
        setOrder(result.order);
        setOrderItems(result.orderItems);

        setShippingHub(
          result.shippingHub ?? null,
        );

        setLoading(false);
      } catch (loadError) {
        console.error(
          "Seller order load error:",
          loadError,
        );

        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this order.",
        );

        setLoading(false);
      }
    }

    void loadOrder();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      () => {
        void loadOrder();
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [numericOrderId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-gray-500">
          Loading order...
        </p>
      </main>
    );
  }

  if (notSignedIn) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          Selling
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Seller Order
        </h1>

        <p className="mt-4 text-gray-600">
          Sign in to a seller account to
          view this order.
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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          Selling
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          You don&apos;t have a seller shop yet.
        </h1>

        <p className="mt-4 max-w-xl text-gray-600">
          Open a Noisebox shop before you
          can access seller orders.
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

  if (notAllowed) {
    notFound();
  }

  if (
    error ||
    !seller ||
    !order
  ) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-red-600">
          {error ??
            "Unable to load this order."}
        </p>
      </main>
    );
  }

  const orderDate =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
    ).format(
      new Date(order.created_at),
    );

  const sellerTotal =
    orderItems.reduce(
      (total, item) =>
        total +
        Number(item.line_total),
      0,
    );

  const hasItemsToShip =
    orderItems.some(
      (item) =>
        item.fulfillment_status ===
        "needs_shipping",
    );

  const isHubOrder =
    order.shipping_method === "hub";

  const hasBuyerAddress =
    Boolean(
      order.shipping_address_line1 ||
        order.shipping_city ||
        order.shipping_postal_code,
    );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/seller/orders"
        className="text-sm font-medium underline"
      >
        ← Back to Orders
      </Link>

      <div className="mt-6 flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {seller.shop_name} · Order #
            {order.id}
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Order Details
          </h1>

          <p className="mt-2 text-gray-600">
            {orderDate}
          </p>
        </div>

        <div className="md:text-right">
          <p className="text-sm text-gray-500">
            Order Status
          </p>

          <p className="mt-1 font-semibold capitalize">
            {order.status.replaceAll(
              "_",
              " ",
            )}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="text-xl font-semibold">
            Items
          </h2>

          <div className="mt-4 space-y-4">
            {orderItems.map(
              (item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 bg-white p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:justify-between">
                    <div>
                      {item.artist && (
                        <p className="text-sm text-gray-500">
                          {item.artist}
                        </p>
                      )}

                      <h3 className="mt-1 text-lg font-semibold">
                        {item.title}
                      </h3>

                      <div className="mt-4 space-y-1 text-sm text-gray-600">
                        {item.format && (
                          <p>
                            Format:{" "}
                            {item.format}
                          </p>
                        )}

                        {item.media_condition && (
                          <p>
                            Media condition:{" "}
                            {
                              item.media_condition
                            }
                          </p>
                        )}

                        {item.sleeve_condition && (
                          <p>
                            Sleeve condition:{" "}
                            {
                              item.sleeve_condition
                            }
                          </p>
                        )}

                        <p>
                          Quantity:{" "}
                          {item.quantity}
                        </p>

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

                    <div className="sm:text-right">
                      <p className="font-semibold">
                        $
                        {Number(
                          item.line_total,
                        ).toFixed(2)}
                      </p>

                      <p className="mt-2 text-sm font-medium capitalize">
                        {item.fulfillment_status ===
                        "needs_shipping"
                          ? "Needs Shipping"
                          : item.fulfillment_status ===
                              "shipped"
                            ? "Shipped"
                            : item.fulfillment_status.replaceAll(
                                "_",
                                " ",
                              )}
                      </p>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="border border-gray-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Ship To
            </p>

            {isHubOrder ? (
              shippingHub ? (
                <>
                  <div className="mt-4">
                    <p className="font-semibold">
                      {shippingHub.name}
                    </p>

                    <address className="mt-2 not-italic text-sm leading-6 text-gray-600">
                      <p>
                        {
                          shippingHub.address_line1
                        }
                      </p>

                      {shippingHub.address_line2 && (
                        <p>
                          {
                            shippingHub.address_line2
                          }
                        </p>
                      )}

                      <p>
                        {shippingHub.city}
                        {shippingHub.state
                          ? `, ${shippingHub.state}`
                          : ""}{" "}
                        {
                          shippingHub.postal_code
                        }
                      </p>

                      <p>
                        {
                          shippingHub.country_code
                        }
                      </p>
                    </address>
                  </div>

                  <div className="mt-5 border-t border-gray-200 pt-5">
                    <p className="text-sm font-semibold">
                      Noisebox Consolidated Shipping
                    </p>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Ship this order to the
                      Noisebox hub shown above.
                      Noisebox will combine the
                      buyer&apos;s packages and
                      handle the final
                      international shipment.
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-red-600">
                  The shipping hub could not
                  be loaded. Do not ship this
                  order until the destination
                  is confirmed.
                </p>
              )
            ) : hasBuyerAddress ? (
              <div className="mt-4">
                {order.shipping_name && (
                  <p className="font-semibold">
                    {order.shipping_name}
                  </p>
                )}

                <address className="mt-2 not-italic text-sm leading-6 text-gray-600">
                  {order.shipping_address_line1 && (
                    <p>
                      {
                        order.shipping_address_line1
                      }
                    </p>
                  )}

                  {order.shipping_address_line2 && (
                    <p>
                      {
                        order.shipping_address_line2
                      }
                    </p>
                  )}

                  <p>
                    {order.shipping_city}

                    {order.shipping_state
                      ? `, ${order.shipping_state}`
                      : ""}

                    {order.shipping_postal_code
                      ? ` ${order.shipping_postal_code}`
                      : ""}
                  </p>

                  {order.shipping_country && (
                    <p>
                      {
                        order.shipping_country
                      }
                    </p>
                  )}
                </address>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-red-600">
                The buyer&apos;s shipping
                address is not available for
                this order.
              </p>
            )}
          </div>

          <div className="border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold">
              Buyer
            </h2>

            {order.shipping_name && (
              <p className="mt-3 font-medium">
                {order.shipping_name}
              </p>
            )}

            <p
              className={
                order.shipping_name
                  ? "mt-1 text-sm text-gray-600"
                  : "mt-3 text-sm text-gray-600"
              }
            >
              {order.buyer_email ??
                "Email not available"}
            </p>
          </div>

          <div className="border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold">
              Seller Summary
            </h2>

            <div className="mt-4 flex justify-between">
              <span className="text-gray-600">
                Merchandise
              </span>

              <span>
                ${sellerTotal.toFixed(2)}
              </span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-gray-600">
                Shipping method
              </span>

              <span className="text-right font-medium">
                {isHubOrder
                  ? "Noisebox Hub"
                  : "Direct"}
              </span>
            </div>

            {isHubOrder && (
              <div className="mt-3 flex justify-between">
                <span className="text-gray-600">
                  Sellers → Hub
                </span>

                <span>
                  $
                  {Number(
                    order.seller_shipping_total ??
                      0,
                  ).toFixed(2)}
                </span>
              </div>
            )}

            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>
                  Merchandise Total
                </span>

                <span>
                  ${sellerTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {hasItemsToShip ? (
            <MarkAsShippedButton
              orderId={order.id}
            />
          ) : (
            <div className="border border-gray-200 bg-gray-50 p-4 text-center text-sm font-medium">
              This order has been shipped.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}