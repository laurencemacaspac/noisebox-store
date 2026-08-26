"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function CartPage() {
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useCart();

  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Your Cart</h1>

          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-sm underline hover:text-gray-500"
            >
              Clear Cart
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="mt-8">
            <p className="text-gray-600">
              Your cart is empty.
            </p>

            <Link
              href="/#shop"
              className="mt-6 inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-10 space-y-8">
              {cartItems.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-6 border-b border-gray-200 pb-8"
                >
                  {/* Product Image */}
                  <div className="relative h-28 w-28 shrink-0 overflow-hidden bg-gray-100">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.productName}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-3 text-center">
                        <span className="text-xs uppercase tracking-wider text-gray-400">
                          Noisebox
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Information */}
                  <div className="flex flex-1 justify-between gap-6">
                    <div>
                      <h2 className="font-medium">
                        {item.productName}
                      </h2>

                      <p className="mt-2 text-sm text-gray-500">
                        ${Number(item.price).toFixed(2)} each
                      </p>

                      <div className="mt-4 flex items-center gap-3">
                        <label
                          htmlFor={`quantity-${item.productId}`}
                          className="text-sm text-gray-500"
                        >
                          Quantity:
                        </label>

                        <select
                          id={`quantity-${item.productId}`}
                          value={item.quantity}
                          onChange={(event) =>
                            updateQuantity(
                              item.productId,
                              Number(event.target.value),
                            )
                          }
                          className="border border-gray-300 bg-white px-3 py-2"
                        >
                          {[1, 2, 3, 4, 5].map((number) => (
                            <option
                              key={number}
                              value={number}
                            >
                              {number}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeFromCart(item.productId)
                        }
                        className="mt-4 text-sm underline hover:text-gray-500"
                      >
                        Remove
                      </button>
                    </div>

                    <p className="font-medium">
                      $
                      {(
                        item.price * item.quantity
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Summary */}
            <div className="mt-10 flex justify-end">
              <div className="w-full max-w-sm">
                <div className="flex justify-between text-lg font-medium">
                  <span>Subtotal</span>

                  <span>
                    ${subtotal.toFixed(2)}
                  </span>
                </div>

                <p className="mt-2 text-sm text-gray-500">
                  Shipping and taxes are calculated during
                  checkout.
                </p>

                <Link
                  href="/checkout"
                  className="mt-6 block w-full bg-black px-6 py-4 text-center text-white transition hover:bg-gray-800"
                >
                  Checkout
                </Link>

                <Link
                  href="/#shop"
                  className="mt-4 block text-center text-sm underline hover:text-gray-500"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}