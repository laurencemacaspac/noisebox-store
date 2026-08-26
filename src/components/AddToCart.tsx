"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";

type AddToCartProps = {
  productId: number;
  sellerId: number;
  productName: string;
  price: number;
  image: string;
  maxQuantity?: number;
};

export default function AddToCart({
  productId,
  sellerId,
  productName,
  price,
  image,
  maxQuantity = 1,
}: AddToCartProps) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { addToCart } = useCart();

  const availableQuantity = Math.max(
    1,
    maxQuantity,
  );

  return (
    <div className="mt-8">
      <div>
        <label
          htmlFor="quantity"
          className="mb-2 block text-sm font-medium"
        >
          Quantity
        </label>

        <select
          id="quantity"
          value={quantity}
          onChange={(event) => {
            setQuantity(
              Number(event.target.value),
            );
            setAdded(false);
          }}
          className="h-12 min-w-24 border border-gray-300 bg-white px-4 text-sm outline-none transition focus:border-black"
        >
          {Array.from(
            {
              length: availableQuantity,
            },
            (_, index) => index + 1,
          ).map((number) => (
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
        onClick={() => {
          addToCart({
            productId,
            sellerId,
            productName,
            price,
            image,
            quantity,
          });

          setAdded(true);
        }}
        className="mt-8 w-full bg-black px-8 py-4 text-sm font-semibold text-white transition hover:bg-gray-800 md:w-auto"
      >
        {added
          ? "Added to Cart!"
          : "Add to Cart"}
      </button>
    </div>
  );
}