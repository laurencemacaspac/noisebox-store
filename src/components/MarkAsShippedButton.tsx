"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type MarkAsShippedButtonProps = {
  orderId: number;
};

export default function MarkAsShippedButton({
  orderId,
}: MarkAsShippedButtonProps) {
  const router = useRouter();

  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const canMarkShipped =
    carrier.trim().length > 0 &&
    trackingNumber.trim().length > 0 &&
    !isLoading;

  async function handleMarkAsShipped() {
    if (!canMarkShipped) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      /*
       * Get the current Supabase session.
       *
       * The access token is sent to our shipping
       * API so the server can determine which
       * seller is actually logged in.
       */
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Your sign-in session is no longer valid. Please sign in again.",
        );
      }

      const response = await fetch(
        `/api/seller/orders/${encodeURIComponent(
          String(orderId),
        )}/ship`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            carrier: carrier.trim(),

            trackingNumber:
              trackingNumber.trim(),
          }),
        },
      );

      const text = await response.text();

      let result: {
        success?: boolean;
        error?: string;
      } = {};

      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error(
            `Server returned an unexpected response (${response.status}).`,
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          result.error ??
            `Unable to mark order as shipped (${response.status}).`,
        );
      }

      /*
       * Once shipment succeeds, return to the
       * seller's Orders to Ship list.
       *
       * The shipped order should disappear from
       * that list and appear in Order History.
       */
      router.push("/seller/orders");
      router.refresh();
    } catch (error) {
      console.error(
        "Mark as shipped error:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to mark order as shipped.",
      );

      setIsLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold">
        Shipment
      </h2>

      <p className="mt-2 text-sm leading-6 text-gray-600">
        Enter the carrier and tracking number
        before marking this order as shipped.
      </p>

      <div className="mt-5">
        <label
          htmlFor={`carrier-${orderId}`}
          className="block text-sm font-medium"
        >
          Shipping Carrier
        </label>

        <select
          id={`carrier-${orderId}`}
          value={carrier}
          onChange={(event) => {
            setCarrier(event.target.value);
            setError(null);
          }}
          disabled={isLoading}
          className="mt-2 w-full border border-gray-300 bg-white px-3 py-3 outline-none transition focus:border-black disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          <option value="">
            Select carrier
          </option>

          <option value="USPS">
            USPS
          </option>

          <option value="UPS">
            UPS
          </option>

          <option value="FedEx">
            FedEx
          </option>

          <option value="DHL">
            DHL
          </option>

          <option value="Other">
            Other
          </option>
        </select>
      </div>

      <div className="mt-5">
        <label
          htmlFor={`tracking-${orderId}`}
          className="block text-sm font-medium"
        >
          Tracking Number
        </label>

        <input
          id={`tracking-${orderId}`}
          type="text"
          value={trackingNumber}
          onChange={(event) => {
            setTrackingNumber(
              event.target.value,
            );

            setError(null);
          }}
          disabled={isLoading}
          placeholder="Enter tracking number"
          autoComplete="off"
          className="mt-2 w-full border border-gray-300 px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-black disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <button
        type="button"
        onClick={
          handleMarkAsShipped
        }
        disabled={!canMarkShipped}
        className="mt-5 w-full bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isLoading
          ? "Updating..."
          : "Mark as Shipped"}
      </button>

      {!carrier && (
        <p className="mt-3 text-xs text-gray-500">
          Select a shipping carrier to
          continue.
        </p>
      )}

      {carrier &&
        !trackingNumber.trim() && (
          <p className="mt-3 text-xs text-gray-500">
            Enter a tracking number to
            continue.
          </p>
        )}

      {error && (
        <p className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}