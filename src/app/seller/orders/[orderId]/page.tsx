import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import MarkAsShippedButton from "@/components/MarkAsShippedButton";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function SellerOrderDetailPage({
  params,
}: PageProps) {
  const { orderId } = await params;

  const numericOrderId = Number(orderId);

  if (
    !Number.isInteger(numericOrderId) ||
    numericOrderId <= 0
  ) {
    notFound();
  }

  /*
   * Temporary seller ID.
   *
   * Later this will come from the authenticated
   * seller account.
   */
  const sellerId = 1;

  /*
   * Load the overall customer order.
   *
   * shipping_method tells us whether this seller
   * should ship directly to the buyer or to a
   * Noisebox consolidation hub.
   */
  const { data: order, error: orderError } =
    await supabaseAdmin
      .from("orders")
      .select(`
        id,
        status,
        buyer_email,
        subtotal,
        shipping_total,
        seller_shipping_total,
        hub_shipping_total,
        shipping_method,
        shipping_hub_id,
        total,
        currency,
        created_at
      `)
      .eq("id", numericOrderId)
      .single();

  if (orderError || !order) {
    console.error(
      "Seller order error:",
      orderError,
    );

    notFound();
  }

  const typedOrder =
    order as unknown as Order;

  /*
   * Only retrieve items belonging to this seller.
   *
   * A single Noisebox customer order can contain
   * products from multiple sellers. Each seller
   * must only see their own merchandise.
   */
  const { data: items, error: itemsError } =
    await supabaseAdmin
      .from("order_items")
      .select(`
        id,
        order_id,
        listing_id,
        seller_id,
        artist,
        title,
        format,
        media_condition,
        sleeve_condition,
        quantity,
        unit_price,
        line_total,
        fulfillment_status
      `)
      .eq("order_id", numericOrderId)
      .eq("seller_id", sellerId)
      .order("id", { ascending: true });

  if (itemsError) {
    console.error(
      "Seller order items error:",
      itemsError,
    );

    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-red-600">
          Unable to load this order.
        </p>
      </main>
    );
  }

  const orderItems =
    (items ?? []) as unknown as OrderItem[];

  /*
   * If this order contains no merchandise belonging
   * to this seller, don't allow the seller to view it.
   */
  if (orderItems.length === 0) {
    notFound();
  }

  /*
   * Consolidated orders go to a Noisebox hub.
   *
   * Retrieve the hub using the ID stored on the
   * order. We deliberately do NOT hard-code hub #1.
   */
  let shippingHub: ShippingHub | null = null;

  if (
    typedOrder.shipping_method === "hub" &&
    typedOrder.shipping_hub_id !== null
  ) {
    const {
      data: hub,
      error: hubError,
    } = await supabaseAdmin
      .from("shipping_hubs")
      .select(`
        id,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country_code
      `)
      .eq(
        "id",
        typedOrder.shipping_hub_id,
      )
      .single();

    if (hubError) {
      console.error(
        "Shipping hub error:",
        hubError,
      );
    }

    if (hub) {
      shippingHub =
        hub as unknown as ShippingHub;
    }
  }

  const orderDate =
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(
      new Date(
        typedOrder.created_at,
      ),
    );

  /*
   * This seller's merchandise total only.
   *
   * We do not show the entire marketplace order
   * merchandise value to an individual seller.
   */
  const sellerTotal =
    orderItems.reduce(
      (total, item) =>
        total +
        Number(
          item.line_total,
        ),
      0,
    );

  const hasItemsToShip =
    orderItems.some(
      (item) =>
        item.fulfillment_status ===
        "needs_shipping",
    );

  const isHubOrder =
    typedOrder.shipping_method === "hub";

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
            Order #{typedOrder.id}
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
            {typedOrder.status.replaceAll(
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
            {orderItems.map((item) => (
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
                          Format: {item.format}
                        </p>
                      )}

                      {item.media_condition && (
                        <p>
                          Media condition:{" "}
                          {item.media_condition}
                        </p>
                      )}

                      {item.sleeve_condition && (
                        <p>
                          Sleeve condition:{" "}
                          {item.sleeve_condition}
                        </p>
                      )}

                      <p>
                        Quantity: {item.quantity}
                      </p>
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
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          {/* Shipping Instructions */}
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
                        {shippingHub.address_line1}
                      </p>

                      {shippingHub.address_line2 && (
                        <p>
                          {shippingHub.address_line2}
                        </p>
                      )}

                      <p>
                        {shippingHub.city}
                        {shippingHub.state
                          ? `, ${shippingHub.state}`
                          : ""}{" "}
                        {shippingHub.postal_code}
                      </p>

                      <p>
                        {shippingHub.country_code}
                      </p>
                    </address>
                  </div>

                  <div className="mt-5 border-t border-gray-200 pt-5">
                    <p className="text-sm font-semibold">
                      Noisebox Consolidated Shipping
                    </p>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Ship this order to the Noisebox
                      hub shown above. Noisebox will
                      combine the buyer&apos;s packages
                      and handle the final international
                      shipment.
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-red-600">
                  The shipping hub could not be loaded.
                  Do not ship this order until the
                  destination is confirmed.
                </p>
              )
            ) : (
              <>
                <p className="mt-4 font-semibold">
                  Buyer&apos;s Shipping Address
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  The buyer&apos;s shipping address has
                  not been connected to the order yet.
                  We&apos;ll add this in the next
                  checkout update.
                </p>
              </>
            )}
          </div>

          {/* Buyer */}
          <div className="border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold">
              Buyer
            </h2>

            <p className="mt-3 text-sm text-gray-600">
              {typedOrder.buyer_email ??
                "Email not available"}
            </p>
          </div>

          {/* Seller Summary */}
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
                    typedOrder.seller_shipping_total ??
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
              orderId={typedOrder.id}
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