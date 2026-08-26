import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  const signature = request.headers.get(
    "stripe-signature",
  );

  if (!signature) {
    return NextResponse.json(
      {
        error: "Missing Stripe signature.",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * Stripe webhook verification requires the RAW
   * request body.
   *
   * Do NOT use request.json() here.
   */
  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "Invalid webhook signature.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    /*
     * We only need to process successful
     * Stripe Checkout sessions here.
     *
     * Other Stripe events are acknowledged
     * with a 200 response below.
     */
    if (
      event.type ===
      "checkout.session.completed"
    ) {
      const session =
        event.data.object as Stripe.Checkout.Session;

      /*
       * Don't fulfill anything unless Stripe
       * confirms that payment was actually made.
       */
      if (session.payment_status !== "paid") {
        console.log(
          `Checkout session ${session.id} completed without paid status.`,
        );

        return NextResponse.json({
          received: true,
        });
      }

      /*
       * /api/checkout stores our Noisebox order ID
       * in the Stripe Checkout Session metadata.
       */
      const orderIdText =
        session.metadata?.noisebox_order_id;

      /*
       * A generic "stripe trigger" test event won't
       * contain Noisebox metadata.
       *
       * We acknowledge it instead of returning 500.
       * A real Noisebox checkout WILL contain it.
       */
      if (!orderIdText) {
        console.log(
          "Checkout session has no Noisebox order ID. Ignoring non-Noisebox checkout event.",
        );

        return NextResponse.json({
          received: true,
        });
      }

      const orderId = Number(orderIdText);

      if (
        !Number.isInteger(orderId) ||
        orderId <= 0
      ) {
        throw new Error(
          "Stripe session contains an invalid Noisebox order ID.",
        );
      }

      /*
       * Load the Noisebox order.
       */
      const {
        data: order,
        error: orderError,
      } = await supabaseAdmin
        .from("orders")
        .select(`
          id,
          status
        `)
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        throw new Error(
          `Noisebox order ${orderId} could not be found.`,
        );
      }

      /*
       * Stripe can deliver the same webhook more
       * than once.
       *
       * If we've already processed this order,
       * acknowledge the duplicate without reducing
       * inventory a second time.
       */
      if (order.status === "paid") {
        console.log(
          `Noisebox order ${orderId} was already processed.`,
        );

        return NextResponse.json({
          received: true,
        });
      }

      /*
       * Save payment information on the main order.
       */
      const {
        error: updateOrderError,
      } = await supabaseAdmin
        .from("orders")
        .update({
          status: "paid",

          stripe_checkout_session_id:
            session.id,

          stripe_payment_intent_id:
            typeof session.payment_intent ===
            "string"
              ? session.payment_intent
              : session.payment_intent?.id ??
                null,

          buyer_email:
            session.customer_details?.email ??
            session.customer_email ??
            null,

          shipping_name:
            session.customer_details?.name ??
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateOrderError) {
        throw updateOrderError;
      }

      /*
       * Move the purchased seller items from
       * awaiting payment to needs shipping.
       */
      const {
        error: updateItemsError,
      } = await supabaseAdmin
        .from("order_items")
        .update({
          fulfillment_status:
            "needs_shipping",

          updated_at:
            new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .eq(
          "fulfillment_status",
          "awaiting_payment",
        );

      if (updateItemsError) {
        throw updateItemsError;
      }

      /*
       * Get the purchased listings so we can
       * reduce marketplace inventory.
       */
      const {
        data: orderItems,
        error: itemsError,
      } = await supabaseAdmin
        .from("order_items")
        .select(`
          listing_id,
          quantity
        `)
        .eq("order_id", orderId);

      if (itemsError) {
        throw itemsError;
      }

      /*
       * Reduce the quantity of each seller listing.
       *
       * When inventory reaches zero, mark the
       * listing as sold.
       */
      for (const item of orderItems ?? []) {
        if (!item.listing_id) {
          continue;
        }

        const {
          data: listing,
          error: listingError,
        } = await supabaseAdmin
          .from("seller_listings")
          .select(`
            id,
            quantity
          `)
          .eq("id", item.listing_id)
          .single();

        if (listingError || !listing) {
          console.error(
            `Listing ${item.listing_id} could not be loaded.`,
          );

          continue;
        }

        const remainingQuantity = Math.max(
          Number(listing.quantity) -
            Number(item.quantity),
          0,
        );

        const {
          error: inventoryError,
        } = await supabaseAdmin
          .from("seller_listings")
          .update({
            quantity:
              remainingQuantity,

            status:
              remainingQuantity === 0
                ? "sold"
                : "for_sale",

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", item.listing_id);

        if (inventoryError) {
          throw inventoryError;
        }
      }

      console.log(
        `Noisebox order ${orderId} marked paid and ready for shipping.`,
      );
    }

    /*
     * Stripe expects a successful HTTP response
     * when the webhook was received.
     */
    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Stripe webhook processing error:",
      error,
    );

    /*
     * Returning 500 tells Stripe that processing
     * failed so it can retry the webhook.
     */
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      {
        status: 500,
      },
    );
  }
}