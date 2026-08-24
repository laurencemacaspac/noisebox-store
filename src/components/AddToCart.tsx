"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";

type AddToCartProps = {
  productId: number;
  productName: string;
  price: number;
  image: string;
};

export default function AddToCart({
  productId,
  productName,
  price,
  image,
}: AddToCartProps) {
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { addToCart } = useCart();

  const sizes = ["S", "M", "L", "XL"];

  return (
    <div className="mt-8">
      <p className="mb-3 font-medium">Size</p>

      <div className="flex gap-2">
        {sizes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSize(item)}
            className={`h-11 w-14 border ${
              size === item
                ? "border-black bg-black text-white"
                : "border-gray-300 bg-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <label htmlFor="quantity" className="mb-2 block font-medium">
          Quantity
        </label>

        <select
          id="quantity"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="border border-gray-300 px-4 py-3"
        >
          {[1, 2, 3, 4, 5].map((number) => (
            <option key={number} value={number}>
              {number}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={!size}
        onClick={() => {
          addToCart({
            productId,
            productName,
            price,
            image,
            size,
            quantity,
          });

          setAdded(true);
        }}
        className="mt-8 w-full bg-black px-6 py-4 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 md:w-auto"
      >
        {!size ? "Select a Size" : added ? "Added to Cart!" : "Add to Cart"}
      </button>
    </div>
  );
}
