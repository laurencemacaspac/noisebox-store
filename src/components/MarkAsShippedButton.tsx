"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MarkAsShippedButtonProps = {
  orderId: number;
};

export default function MarkAsShippedButton({
  orderId,
}: MarkAsShippedButtonProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkAsShipped() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/seller/orders/${encodeURIComponent(String(orderId))}/ship`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

      router.push("/seller/orders");
      router.refresh();
    } catch (error) {
      console.error("Mark as shipped error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to mark order as shipped.",
      );

      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleMarkAsShipped}
        disabled={isLoading}
        className="w-full bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isLoading ? "Updating..." : "Mark as Shipped"}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}