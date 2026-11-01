
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
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  /*
   * Stripe requires the original raw request body
   * for webhook signature verification.
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
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }

  try {
    /*
     * Process successful Checkout sessions only.
     */
    if (
      event.type !== "checkout.session.completed"
    ) {
      return NextResponse.json({
        received: true,
      });
    }

    const session =
      event.data.object as Stripe.Checkout.Session;

    /*
     * Only fulfill orders with confirmed payment.
     */
    if (session.payment_status !== "paid") {
      console.log(
        `Checkout session ${session.id} is not paid.`,
      );

      return NextResponse.json({
        received: true,
      });
    }

    /*
     * Retrieve the Noisebox order ID from
     * Checkout Session metadata.
     */
    const orderIdText =
      session.metadata?.noisebox_order_id;

    /*
     * Generic Stripe test events may not contain
     * Noisebox metadata.
     */
    if (!orderIdText) {
      console.log(
        "No Noisebox order ID found. Ignoring event.",
      );

      return NextResponse.json({
        received: true,
      });
    }

    const orderId = Number(orderIdText);

    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0
    ) {
      throw new Error(
        "Invalid Noisebox order ID in Stripe metadata.",
      );
    }

    /*
     * The database function handles:
     *
     * 1. Order locking
     * 2. Duplicate processing protection
     * 3. Inventory quantity updates
     * 4. Sold-out listing statuses
     * 5. Order item fulfillment statuses
     * 6. Order payment status
     *
     * All changes occur in one transaction.
     */
    const {
      data: result,
      error: processingError,
    } = await supabaseAdmin.rpc(
      "process_paid_noisebox_order",
      {
        p_order_id: orderId,
        p_session_id: session.id,

        p_payment_intent_id:
          typeof session.payment_intent ===
          "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,

        p_buyer_email:
          session.customer_details?.email ??
          session.customer_email ??
          null,

        p_shipping_name:
          session.customer_details?.name ?? null,
      },
    );

    if (processingError) {
      throw processingError;
    }

    if (result === "already_processed") {
      console.log(
        `Noisebox order ${orderId} was already processed.`,
      );

      return NextResponse.json({
        received: true,
      });
    }

    if (result !== "processed") {
      throw new Error(
        `Unexpected fulfillment result for order ${orderId}: ${String(result)}`,
      );
    }

    console.log(
      `Noisebox order ${orderId} successfully paid and fulfilled.`,
    );

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Stripe webhook processing error:",
      error,
    );

    /*
     * HTTP 500 tells Stripe to retry the event.
     * The database function prevents duplicate
     * inventory deductions after success.
     */
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}
