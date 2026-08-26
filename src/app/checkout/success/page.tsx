"use client";

import {
  Suspense,
  useEffect,
  useRef,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/CartProvider";

function CheckoutSuccessContent() {
  const { clearCart, cartLoaded } = useCart();

  const searchParams = useSearchParams();

  const sessionId =
    searchParams.get("session_id");

  /*
   * Prevent the cart-clear operation from running
   * more than once during this page lifecycle.
   */
  const cartCleared = useRef(false);

  useEffect(() => {
    /*
     * Do not clear the cart until it has been
     * restored from localStorage.
     */
    if (!cartLoaded) {
      return;
    }

    /*
     * Do not clear the cart simply because someone
     * manually visits /checkout/success.
     *
     * Stripe must have returned a session_id.
     */
    if (!sessionId) {
      return;
    }

    if (cartCleared.current) {
      return;
    }

    cartCleared.current = true;

    clearCart();
  }, [
    cartLoaded,
    clearCart,
    sessionId,
  ]);

  /*
   * Someone manually visited the success URL without
   * coming back from Stripe.
   */
  if (!sessionId) {
    return (
      <main className="min-h-screen bg-white text-black">
        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            Checkout
          </p>

          <h1 className="mt-4 text-4xl font-bold">
            Order Not Confirmed
          </h1>

          <p className="mt-6 text-lg leading-8 text-gray-600">
            We could not confirm a completed checkout
            session.
          </p>

          <Link
            href="/cart"
            className="mt-10 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
          >
            Return to Cart
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
          Order Confirmed
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Thanks for your order!
        </h1>

        <p className="mt-6 text-lg leading-8 text-gray-600">
          Your test payment was successful.
        </p>

        <Link
          href="/"
          className="mt-10 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
        >
          Return to Store
        </Link>
      </section>
    </main>
  );
}

/*
 * Next.js requires components that use
 * useSearchParams() during prerendering to be
 * rendered beneath a Suspense boundary.
 */
function CheckoutSuccessLoading() {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
          Checkout
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Confirming your order...
        </h1>
      </section>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={<CheckoutSuccessLoading />}
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}