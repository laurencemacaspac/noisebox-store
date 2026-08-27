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

export async function GET(
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
     * Authenticate the logged-in Supabase user.
     */
    const authorizationHeader =
      request.headers.get("authorization");

    if (
      !authorizationHeader ||
      !authorizationHeader.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to view this order.",
        },
        { status: 401 },
      );
    }

    const accessToken = authorizationHeader
      .slice("Bearer ".length)
      .trim();

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Invalid authentication token.",
        },
        { status: 401 },
      );
    }

    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.getUser(
      accessToken,
    );

    if (authError || !authData.user) {
      console.error(
        "Seller order authentication error:",
        authError,
      );

      return NextResponse.json(
        {
          error:
            "Your sign-in session is no longer valid. Please sign in again.",
        },
        { status: 401 },
      );
    }

    /*
     * Find the seller account belonging to
     * this authenticated user.
     */
    const {
      data: seller,
      error: sellerError,
    } = await supabaseAdmin
      .from("sellers")
      .select(`
        id,
        user_id,
        shop_name,
        shop_slug,
        description
      `)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (sellerError) {
      throw sellerError;
    }

    if (!seller) {
      return NextResponse.json(
        {
          error:
            "This account is not registered as a seller.",
        },
        { status: 403 },
      );
    }

    /*
     * Verify that this seller actually owns
     * merchandise in this order.
     *
     * For multi-seller orders, the seller only
     * receives their own order items.
     */
    const {
      data: orderItems,
      error: itemsError,
    } = await supabaseAdmin
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
        fulfillment_status,
        tracking_number,
        shipping_carrier,
        shipped_at
      `)
      .eq("order_id", numericOrderId)
      .eq("seller_id", seller.id)
      .order("id", {
        ascending: true,
      });

    if (itemsError) {
      throw itemsError;
    }

    /*
     * Don't reveal whether another seller's
     * order exists.
     */
    if (
      !orderItems ||
      orderItems.length === 0
    ) {
      return NextResponse.json(
        {
          error: "Order not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Seller ownership has now been verified.
     *
     * Retrieve the parent order, including the
     * buyer shipping information needed for
     * direct fulfillment.
     */
    const {
      data: order,
      error: orderError,
    } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        status,
        buyer_email,

        shipping_name,
        shipping_address_line1,
        shipping_address_line2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country,

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
      throw (
        orderError ??
        new Error(
          "Order could not be loaded.",
        )
      );
    }

    /*
     * Load the Noisebox shipping hub when
     * this order uses consolidated shipping.
     *
     * In that case the individual seller ships
     * to Noisebox rather than directly to the
     * buyer.
     */
    let shippingHub = null;

    if (
      order.shipping_method === "hub" &&
      order.shipping_hub_id !== null
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
          order.shipping_hub_id,
        )
        .single();

      if (hubError) {
        console.error(
          "Seller shipping hub error:",
          hubError,
        );
      } else {
        shippingHub = hub;
      }
    }

    /*
     * Return only the authenticated seller's
     * portion of the marketplace order.
     *
     * For consolidated shipping, do not send the
     * buyer's physical address to the seller.
     * The seller only needs the Noisebox hub.
     *
     * The buyer email remains available for
     * identifying the order.
     */
    const safeOrder =
      order.shipping_method === "hub"
        ? {
            ...order,

            shipping_name: null,
            shipping_address_line1: null,
            shipping_address_line2: null,
            shipping_city: null,
            shipping_state: null,
            shipping_postal_code: null,
            shipping_country: null,
          }
        : order;

    return NextResponse.json({
      seller: {
        id: seller.id,
        shop_name: seller.shop_name,
        shop_slug: seller.shop_slug,
      },

      order: safeOrder,

      orderItems,

      shippingHub,
    });
  } catch (error) {
    console.error(
      "Seller order detail API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load seller order.",
      },
      { status: 500 },
    );
  }
}