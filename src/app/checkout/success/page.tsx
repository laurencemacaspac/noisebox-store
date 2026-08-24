"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function CheckoutSuccessPage() {
  const { clearCart, cartLoaded } = useCart();

  useEffect(() => {
    if (cartLoaded) {
      clearCart();
    }
  }, [cartLoaded, clearCart]);

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