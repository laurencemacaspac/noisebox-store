import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type CartItem = {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  size: string;
  image: string;
};

export async function POST(request: Request) {
  try {
    const { cartItems } = (await request.json()) as {
      cartItems: CartItem[];
    };

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty." },
        { status: 400 },
      );
    }

    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: cartItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(item.price * 100),

          product_data: {
            name: `${item.productName} - Size ${item.size}`,
          },
        },
      })),

      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe Checkout error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create checkout session.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}