"use client";

import Image from "next/image";
import { useCart } from "@/components/CartProvider";

export default function CheckoutPage() {
  const { cartItems } = useCart();

  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  async function handleCheckout() {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cartItems,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Something went wrong.");
      return;
    }

    if (data.url) {
      window.location.assign(data.url);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2">
        {/* Customer information */}
        <div>
          <h1 className="text-4xl font-bold">Checkout</h1>

          <div className="mt-10">
            <h2 className="text-xl font-semibold">Contact Information</h2>

            <div className="mt-5">
              <label htmlFor="email" className="mb-2 block text-sm">
                Email
              </label>

              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="w-full border border-gray-300 px-4 py-3"
              />
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-semibold">Shipping Address</h2>

            <div className="mt-5 grid gap-4">
              <input
                type="text"
                placeholder="Full name"
                className="w-full border border-gray-300 px-4 py-3"
              />

              <input
                type="text"
                placeholder="Address"
                className="w-full border border-gray-300 px-4 py-3"
              />

              <input
                type="text"
                placeholder="Apartment, suite, etc. (optional)"
                className="w-full border border-gray-300 px-4 py-3"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="City"
                  className="w-full border border-gray-300 px-4 py-3"
                />

                <input
                  type="text"
                  placeholder="State"
                  className="w-full border border-gray-300 px-4 py-3"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="ZIP code"
                  className="w-full border border-gray-300 px-4 py-3"
                />

                <input
                  type="text"
                  placeholder="Country"
                  className="w-full border border-gray-300 px-4 py-3"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={cartItems.length === 0}
            className="mt-10 w-full bg-black px-6 py-4 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Continue to Payment
          </button>
        </div>

        {/* Order summary */}
        <aside className="lg:border-l lg:border-gray-200 lg:pl-12">
          <h2 className="text-xl font-semibold">Order Summary</h2>

          {cartItems.length === 0 ? (
            <p className="mt-6 text-gray-500">Your cart is empty.</p>
          ) : (
            <div className="mt-6 space-y-6">
              {cartItems.map((item) => (
                <div
                  key={`${item.productId}-${item.size}`}
                  className="flex gap-4"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-gray-100">
                    <Image
                      src={item.image}
                      alt={item.productName}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex flex-1 justify-between gap-4">
                    <div>
                      <p className="font-medium">{item.productName}</p>

                      <p className="mt-1 text-sm text-gray-500">
                        Size: {item.size}
                      </p>

                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity}
                      </p>
                    </div>

                    <p className="font-medium">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex justify-between text-lg font-medium">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Shipping and taxes will be calculated later.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
