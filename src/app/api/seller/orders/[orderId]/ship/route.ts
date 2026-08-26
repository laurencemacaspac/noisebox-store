import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { orderId } = await context.params;
    const numericOrderId = Number(orderId);

    if (
      !Number.isInteger(numericOrderId) ||
      numericOrderId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid order ID." },
        { status: 400 },
      );
    }

    /*
     * Temporary seller ID.
     *
     * Later this will come from the logged-in
     * Supabase user instead of being hard-coded.
     */
    const sellerId = 1;

    /*
     * Make sure this seller actually has items
     * belonging to this order.
     */
    const { data: items, error: itemsError } =
      await supabaseAdmin
        .from("order_items")
        .select(`
          id,
          fulfillment_status
        `)
        .eq("order_id", numericOrderId)
        .eq("seller_id", sellerId);

    if (itemsError) {
      throw itemsError;
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 },
      );
    }

    /*
     * Only items currently waiting for shipment
     * should be changed.
     */
    const itemsToShip = items.filter(
      (item) =>
        item.fulfillment_status ===
        "needs_shipping",
    );

    if (itemsToShip.length === 0) {
      return NextResponse.json(
        {
          error:
            "This order has already been shipped or is not ready to ship.",
        },
        { status: 400 },
      );
    }

    /*
     * Mark this seller's items as shipped.
     *
     * This is intentionally scoped by BOTH
     * order_id and seller_id because a future
     * marketplace order may contain items from
     * several different sellers.
     */
    const { error: updateError } =
      await supabaseAdmin
        .from("order_items")
        .update({
          fulfillment_status: "shipped",
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", numericOrderId)
        .eq("seller_id", sellerId)
        .eq(
          "fulfillment_status",
          "needs_shipping",
        );

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      orderId: numericOrderId,
    });
  } catch (error) {
    console.error(
      "Mark order as shipped error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to mark order as shipped.",
      },
      { status: 500 },
    );
  }
}