import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: Request) {
  try {
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
            "You must be signed in to view seller orders.",
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
      return NextResponse.json(
        {
          error:
            "Your sign-in session is no longer valid. Please sign in again.",
        },
        { status: 401 },
      );
    }

    /*
     * Find the seller belonging to this user.
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
        { status: 403 },
      );
    }

    /*
     * Retrieve only this seller's items that
     * still need fulfillment.
     *
     * Because this runs server-side with the
     * service role, we can also retrieve the
     * parent order's buyer information without
     * weakening browser RLS policies.
     */
    const {
      data: orderItems,
      error: ordersError,
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
        quantity,
        unit_price,
        line_total,
        fulfillment_status,

        orders!order_items_order_id_fkey (
          id,
          status,
          buyer_email,
          shipping_name,
          created_at
        )
      `)
      .eq(
        "seller_id",
        seller.id,
      )
      .neq(
        "fulfillment_status",
        "shipped",
      )
      .order("id", {
        ascending: false,
      });

    if (ordersError) {
      throw ordersError;
    }

    return NextResponse.json({
      seller: {
        id: seller.id,
        shop_name: seller.shop_name,
        shop_slug: seller.shop_slug,
      },

      orderItems:
        orderItems ?? [],
    });
  } catch (error) {
    console.error(
      "Seller orders API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load seller orders.",
      },
      { status: 500 },
    );
  }
}