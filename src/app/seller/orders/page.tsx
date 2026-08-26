import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  /*
   * Supabase relationship results can be represented
   * as either an object or an array depending on
   * relationship inference.
   */
  orders: Order | Order[] | null;
};

export default async function SellerOrdersPage() {
  /*
   * Temporary seller ID.
   * Later this will come from the logged-in seller.
   */
  const sellerId = 1;

  const { data, error } = await supabaseAdmin
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

      orders!order_items_order_id_fkey (
        id,
        status,
        buyer_email,
        created_at
      )
    `,
    )
    .eq("seller_id", sellerId)
    .neq("fulfillment_status", "shipped")
    .order("id", { ascending: false });

  if (error) {
    console.error(
      "Seller orders error:",
      error,
    );

    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">
          Orders
        </h1>

        <p className="mt-6 text-red-600">
          Unable to load orders.
        </p>
      </main>
    );
  }

  /*
   * Normalize Supabase's generated result to the
   * shape used by this page.
   */
  const orderItems =
    (data ?? []) as unknown as OrderItem[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
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
            You don&apos;t have any orders to ship.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orderItems.map((item) => {
            /*
             * Handle either relationship shape safely.
             */
            const order = Array.isArray(item.orders)
              ? item.orders[0] ?? null
              : item.orders;

            const orderDate = order?.created_at
              ? new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(
                  new Date(order.created_at),
                )
              : "";

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

                      <p>
                        Buyer:{" "}
                        {order?.buyer_email ??
                          "Not available"}
                      </p>

                      <p>
                        Status:{" "}
                        {item.fulfillment_status}
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