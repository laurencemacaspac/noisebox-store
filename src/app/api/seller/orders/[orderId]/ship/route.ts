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

type ShipmentBody = {
  carrier?: unknown;
  trackingNumber?: unknown;
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
        {
          error: "Invalid order ID.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * -------------------------------------------------
     * AUTHENTICATION
     * -------------------------------------------------
     *
     * The browser sends the logged-in Supabase
     * user's access token in the Authorization
     * header.
     *
     * We verify that token with Supabase here.
     *
     * We NEVER accept seller_id from browser JSON.
     */
    const authorizationHeader =
      request.headers.get("authorization");

    if (!authorizationHeader) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to ship an order.",
        },
        {
          status: 401,
        },
      );
    }

    const bearerPrefix = "Bearer ";

    if (
      !authorizationHeader.startsWith(
        bearerPrefix,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid authorization header.",
        },
        {
          status: 401,
        },
      );
    }

    const accessToken =
      authorizationHeader
        .slice(bearerPrefix.length)
        .trim();

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Invalid authentication token.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken,
      );

    if (authError || !authData.user) {
      console.error(
        "Seller shipping authentication error:",
        authError,
      );

      return NextResponse.json(
        {
          error:
            "Your sign-in session is no longer valid. Please sign in again.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * -------------------------------------------------
     * SELLER OWNERSHIP
     * -------------------------------------------------
     *
     * Match the authenticated Supabase Auth UUID
     * to sellers.user_id.
     */
    const {
      data: seller,
      error: sellerError,
    } = await supabaseAdmin
      .from("sellers")
      .select(`
        id,
        shop_name
      `)
      .eq(
        "user_id",
        authData.user.id,
      )
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
        {
          status: 403,
        },
      );
    }

    const sellerId = Number(seller.id);

    /*
     * -------------------------------------------------
     * SHIPPING INFORMATION
     * -------------------------------------------------
     *
     * Carrier and tracking number are required
     * before a seller can mark an order shipped.
     */
    let body: ShipmentBody;

    try {
      body =
        (await request.json()) as ShipmentBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "Shipping information is required.",
        },
        {
          status: 400,
        },
      );
    }

    const carrier =
      typeof body.carrier === "string"
        ? body.carrier.trim()
        : "";

    const trackingNumber =
      typeof body.trackingNumber ===
      "string"
        ? body.trackingNumber.trim()
        : "";

    if (!carrier) {
      return NextResponse.json(
        {
          error:
            "Please select a shipping carrier.",
        },
        {
          status: 400,
        },
      );
    }

    if (!trackingNumber) {
      return NextResponse.json(
        {
          error:
            "Please enter a tracking number before marking this order as shipped.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Avoid extremely large unexpected values.
     */
    if (carrier.length > 100) {
      return NextResponse.json(
        {
          error:
            "Shipping carrier is too long.",
        },
        {
          status: 400,
        },
      );
    }

    if (trackingNumber.length > 200) {
      return NextResponse.json(
        {
          error:
            "Tracking number is too long.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * -------------------------------------------------
     * ORDER OWNERSHIP CHECK
     * -------------------------------------------------
     *
     * Confirm that this particular seller actually
     * owns merchandise in this order.
     *
     * This is essential for multi-seller orders.
     */
    const {
      data: items,
      error: itemsError,
    } = await supabaseAdmin
      .from("order_items")
      .select(`
        id,
        seller_id,
        fulfillment_status
      `)
      .eq(
        "order_id",
        numericOrderId,
      )
      .eq(
        "seller_id",
        sellerId,
      );

    if (itemsError) {
      throw itemsError;
    }

    /*
     * Return 404 rather than revealing that an
     * order belonging to another seller exists.
     */
    if (!items || items.length === 0) {
      return NextResponse.json(
        {
          error: "Order not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Only merchandise currently waiting for
     * shipment may be changed.
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
        {
          status: 400,
        },
      );
    }

    const shippedAt =
      new Date().toISOString();

    /*
     * -------------------------------------------------
     * MARK THIS SELLER'S ITEMS SHIPPED
     * -------------------------------------------------
     *
     * Scope the update by:
     *
     * - order_id
     * - authenticated seller_id
     * - current fulfillment status
     *
     * This prevents Seller A from modifying
     * Seller B's merchandise in a shared order.
     */
    const {
      error: updateError,
    } = await supabaseAdmin
      .from("order_items")
      .update({
        fulfillment_status:
          "shipped",

        shipping_carrier:
          carrier,

        tracking_number:
          trackingNumber,

        shipped_at:
          shippedAt,

        updated_at:
          shippedAt,
      })
      .eq(
        "order_id",
        numericOrderId,
      )
      .eq(
        "seller_id",
        sellerId,
      )
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
      sellerId,
      carrier,
      trackingNumber,
      shippedAt,
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
      {
        status: 500,
      },
    );
  }
}