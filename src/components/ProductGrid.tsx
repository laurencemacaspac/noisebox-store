"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";

type Product = {
  id: number;
  name: string;
  slug: string;
  category: string;
  price: number | string;
  image: string;
};

type ProductGridProps = {
  products: Product[];
};

export default function ProductGrid({ products }: ProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "T-Shirt", "Poster", "Vinyl", "CD"];

  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter(
          (product) => product.category === selectedCategory,
        );

  return (
    <>
      <div className="mb-10 flex flex-wrap gap-3">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`border px-4 py-2 text-sm transition ${
              selectedCategory === category
                ? "border-black bg-black text-white"
                : "border-gray-300 bg-white hover:border-black"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            name={product.name}
            category={product.category}
            price={`$${Number(product.price).toFixed(2)}`}
            image={product.image}
            slug={product.slug}
          />
        ))}
      </div>
    </>
  );
}