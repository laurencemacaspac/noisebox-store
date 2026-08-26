"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";

type ShippingMethod = "direct" | "hub";

type ShippingQuote = {
  country: string;
  isDomestic: boolean;
  sellerCount: number;
  directShipping: number;
  hubShipping: number | null;
  hubAvailable: boolean;
};

export default function CheckoutPage() {
  const { cartItems, cartLoaded } = useCart();

  /*
   * Shipping destination determines whether
   * this is a domestic or international order.
   *
   * US = domestic
   * Everything else = international
   */
  const [country, setCountry] = useState("US");

  const [shippingQuote, setShippingQuote] =
    useState<ShippingQuote | null>(null);

  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("direct");

  const [shippingLoading, setShippingLoading] =
    useState(false);

  const [shippingError, setShippingError] =
    useState("");

  const [checkoutLoading, setCheckoutLoading] =
    useState(false);

  /*
   * Customer fields.
   *
   * We are keeping these here now so they're ready
   * when we connect the complete shipping address
   * to the order.
   */
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] =
    useState("");
  const [postalCode, setPostalCode] = useState("");

  const subtotal = cartItems.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0,
  );

  const isDomestic = country === "US";

  /*
   * Recalculate shipping whenever:
   *
   * - cart contents change
   * - quantities change
   * - destination country changes
   */
  useEffect(() => {
    if (!cartLoaded) {
      return;
    }

    if (cartItems.length === 0) {
      setShippingQuote(null);
      setShippingError("");
      return;
    }

    let cancelled = false;

    async function loadShippingQuote() {
      setShippingLoading(true);
      setShippingError("");

      try {
        const response = await fetch(
          "/api/checkout/shipping",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              country,

              cartItems: cartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to calculate shipping.",
          );
        }

        if (cancelled) {
          return;
        }

        setShippingQuote(data);

        /*
         * Whenever destination changes, return to
         * Direct Shipping.
         *
         * This prevents Hub from remaining selected
         * if someone switches from an international
         * destination back to the United States.
         */
        setShippingMethod("direct");
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Shipping calculation failed:",
          error,
        );

        setShippingQuote(null);

        setShippingError(
          error instanceof Error
            ? error.message
            : "Unable to calculate shipping.",
        );
      } finally {
        if (!cancelled) {
          setShippingLoading(false);
        }
      }
    }

    void loadShippingQuote();

    return () => {
      cancelled = true;
    };
  }, [cartItems, cartLoaded, country]);

  /*
   * Shipping amount currently selected by buyer.
   */
  const selectedShipping =
    shippingMethod === "hub"
      ? (shippingQuote?.hubShipping ?? 0)
      : (shippingQuote?.directShipping ?? 0);

  const estimatedTotal =
    subtotal + selectedShipping;

  /*
   * Potential savings from consolidation.
   */
  const consolidationSavings =
    shippingQuote?.hubShipping !== null &&
    shippingQuote?.hubShipping !== undefined
      ? shippingQuote.directShipping -
        shippingQuote.hubShipping
      : 0;

  async function handleCheckout() {
    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    if (!shippingQuote) {
      alert(
        "Shipping must be calculated before checkout.",
      );
      return;
    }

    /*
     * Client-side protection.
     *
     * The API will eventually enforce this again
     * server-side.
     */
    if (
      country === "US" &&
      shippingMethod === "hub"
    ) {
      alert(
        "Noisebox Consolidated Shipping is only available for international multi-seller orders.",
      );

      return;
    }

    if (
      shippingMethod === "hub" &&
      !shippingQuote.hubAvailable
    ) {
      alert(
        "Noisebox Consolidated Shipping is not available for this order.",
      );

      return;
    }

    setCheckoutLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          cartItems,

          shippingMethod,

          country,

          shippingAddress: {
            email,
            fullName,
            address,
            address2,
            city,
            stateProvince,
            postalCode,
            country,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error || "Something went wrong.",
        );

        return;
      }

      if (!data.url) {
        alert(
          "Checkout URL was not returned.",
        );

        return;
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error(
        "Checkout request failed:",
        error,
      );

      alert(
        "Unable to start checkout. Please try again.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (!cartLoaded) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-gray-500">
            Loading checkout...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2">
        {/* LEFT COLUMN */}
        <div>
          <h1 className="text-4xl font-bold">
            Checkout
          </h1>

          {/* Contact Information */}
          <div className="mt-10">
            <h2 className="text-xl font-semibold">
              Contact Information
            </h2>

            <div className="mt-5">
              <label
                htmlFor="email"
                className="mb-2 block text-sm"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>
          </div>

          {/* Shipping Address */}
          <div className="mt-10">
            <h2 className="text-xl font-semibold">
              Shipping Address
            </h2>

            <div className="mt-5 grid gap-4">
              {/* Full Name */}
              <input
                type="text"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                placeholder="Full name"
                className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />

              {/* Address */}
              <input
                type="text"
                value={address}
                onChange={(event) =>
                  setAddress(event.target.value)
                }
                placeholder="Address"
                className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />

              {/* Address 2 */}
              <input
                type="text"
                value={address2}
                onChange={(event) =>
                  setAddress2(event.target.value)
                }
                placeholder="Apartment, suite, etc. (optional)"
                className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />

              {/* City + State */}
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  value={city}
                  onChange={(event) =>
                    setCity(event.target.value)
                  }
                  placeholder="City"
                  className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />

                <input
                  type="text"
                  value={stateProvince}
                  onChange={(event) =>
                    setStateProvince(
                      event.target.value,
                    )
                  }
                  placeholder="State / Province"
                  className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* Postal Code + Country */}
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  value={postalCode}
                  onChange={(event) =>
                    setPostalCode(
                      event.target.value,
                    )
                  }
                  placeholder="ZIP / Postal code"
                  className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />

                {/* COUNTRY DROPDOWN */}
                <select
                  id="country"
                  value={country}
                  onChange={(event) =>
                    setCountry(
                      event.target.value,
                    )
                  }
                  className="w-full cursor-pointer border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                >
                  <option value="US">
                    United States
                  </option>

                  <option value="CA">
                    Canada
                  </option>

                  <option value="PH">
                    Philippines
                  </option>

                  <option value="GB">
                    United Kingdom
                  </option>

                  <option value="AU">
                    Australia
                  </option>

                  <option value="JP">
                    Japan
                  </option>

                  <option value="DE">
                    Germany
                  </option>

                  <option value="FR">
                    France
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Shipping Method */}
          {cartItems.length > 0 && (
            <div className="mt-10">
              <h2 className="text-xl font-semibold">
                Shipping Method
              </h2>

              {/* Loading */}
              {shippingLoading && (
                <p className="mt-4 text-sm text-gray-500">
                  Calculating shipping...
                </p>
              )}

              {/* Error */}
              {shippingError && (
                <div className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {shippingError}
                </div>
              )}

              {/* Shipping Options */}
              {shippingQuote &&
                !shippingLoading && (
                  <div className="mt-5 space-y-3">
                    {/* DIRECT SHIPPING */}
                    <label className="flex cursor-pointer gap-4 border border-gray-300 p-5 transition hover:border-black">
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="direct"
                        checked={
                          shippingMethod === "direct"
                        }
                        onChange={() =>
                          setShippingMethod("direct")
                        }
                        className="mt-1"
                      />

                      <div className="flex flex-1 justify-between gap-6">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              Ship Directly
                            </p>

                            {!isDomestic &&
                              shippingQuote.sellerCount >
                                1 && (
                                <span className="border border-gray-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                                  Fastest
                                </span>
                              )}
                          </div>

                          <p className="mt-2 text-sm leading-6 text-gray-500">
                            {shippingQuote.sellerCount ===
                            1
                              ? "Your order ships directly from the seller."
                              : isDomestic
                                ? `Your order ships separately from ${shippingQuote.sellerCount} sellers.`
                                : `Each of the ${shippingQuote.sellerCount} sellers ships directly to you. Items may arrive separately.`}
                          </p>
                        </div>

                        <p className="shrink-0 font-semibold">
                          $
                          {shippingQuote.directShipping.toFixed(
                            2,
                          )}
                        </p>
                      </div>
                    </label>

                    {/* INTERNATIONAL HUB OPTION */}
                    {!isDomestic &&
                      shippingQuote.hubAvailable &&
                      shippingQuote.hubShipping !==
                        null && (
                        <label className="flex cursor-pointer gap-4 border border-gray-300 p-5 transition hover:border-black">
                          <input
                            type="radio"
                            name="shippingMethod"
                            value="hub"
                            checked={
                              shippingMethod === "hub"
                            }
                            onChange={() =>
                              setShippingMethod("hub")
                            }
                            className="mt-1"
                          />

                          <div className="flex flex-1 justify-between gap-6">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">
                                  Noisebox
                                  Consolidated
                                </p>

                                {consolidationSavings >
                                  0 && (
                                  <span className="bg-black px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                                    Best Value
                                  </span>
                                )}
                              </div>

                              {consolidationSavings >
                                0 && (
                                <p className="mt-2 text-sm font-semibold">
                                  Save $
                                  {consolidationSavings.toFixed(
                                    2,
                                  )}
                                </p>
                              )}

                              <p className="mt-2 text-sm leading-6 text-gray-500">
                                Sellers ship your
                                items to the Noisebox
                                Hub first. We combine
                                them into one package
                                and send one
                                international shipment
                                to you.
                              </p>

                              <p className="mt-2 text-sm leading-6 text-gray-500">
                                Consolidation may take
                                longer because we wait
                                for all seller packages
                                to arrive before
                                shipping your combined
                                order.
                              </p>
                            </div>

                            <p className="shrink-0 font-semibold">
                              $
                              {shippingQuote.hubShipping.toFixed(
                                2,
                              )}
                            </p>
                          </div>
                        </label>
                      )}

                    {/* Domestic Explanation */}
                    {isDomestic &&
                      shippingQuote.sellerCount >
                        1 && (
                        <p className="text-sm leading-6 text-gray-500">
                          Domestic orders ship
                          directly from each seller.
                          Noisebox Consolidated
                          Shipping is designed for
                          international multi-seller
                          orders.
                        </p>
                      )}

                    {/* International Single Seller */}
                    {!isDomestic &&
                      shippingQuote.sellerCount ===
                        1 && (
                        <p className="text-sm leading-6 text-gray-500">
                          Noisebox Consolidated
                          Shipping becomes available
                          when an international order
                          contains items from multiple
                          sellers.
                        </p>
                      )}
                  </div>
                )}
            </div>
          )}

          {/* Continue */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={
              cartItems.length === 0 ||
              shippingLoading ||
              !shippingQuote ||
              checkoutLoading
            }
            className="mt-10 w-full bg-black px-6 py-4 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {checkoutLoading
              ? "Starting Checkout..."
              : "Continue to Payment"}
          </button>
        </div>

        {/* RIGHT COLUMN */}
        <aside className="lg:border-l lg:border-gray-200 lg:pl-12">
          <h2 className="text-xl font-semibold">
            Order Summary
          </h2>

          {cartItems.length === 0 ? (
            <p className="mt-6 text-gray-500">
              Your cart is empty.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {cartItems.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-4"
                >
                  {/* Product Image */}
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-gray-100">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.productName}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400">
                          Noisebox
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Information */}
                  <div className="flex flex-1 justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {item.productName}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Qty: {item.quantity}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        $
                        {Number(
                          item.price,
                        ).toFixed(2)}{" "}
                        each
                      </p>
                    </div>

                    <p className="font-medium">
                      $
                      {(
                        item.price *
                        item.quantity
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="mt-8 space-y-3 border-t border-gray-200 pt-6">
            <div className="flex justify-between">
              <span>Subtotal</span>

              <span>
                ${subtotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Shipping</span>

              <span>
                {shippingLoading
                  ? "Calculating..."
                  : shippingQuote
                    ? `$${selectedShipping.toFixed(2)}`
                    : "—"}
              </span>
            </div>

            <div className="flex justify-between border-t border-gray-200 pt-4 text-lg font-semibold">
              <span>Estimated Total</span>

              <span>
                $
                {estimatedTotal.toFixed(2)}
              </span>
            </div>

            <p className="text-sm leading-6 text-gray-500">
              Taxes, if applicable, will be
              calculated during payment.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}