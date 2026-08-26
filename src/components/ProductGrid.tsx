"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";

type Product = {
  id: number;
  artist: string | null;
  title: string;
  format: string | null;
  price: number | string;
  media_condition: string | null;
  primary_image_url: string | null;
};

type ProductGridProps = {
  products: Product[];
};

type SortOption =
  | "newest"
  | "artist-asc"
  | "artist-desc"
  | "title-asc"
  | "title-desc"
  | "price-asc"
  | "price-desc"
  | "format-asc";

const PRODUCTS_PER_PAGE = 24;

export default function ProductGrid({
  products,
}: ProductGridProps) {
  const [selectedFormat, setSelectedFormat] =
    useState("All");

  const [searchTerm, setSearchTerm] =
    useState("");

  /*
   * page.tsx supplies products newest-first,
   * so "newest" simply preserves that order.
   */
  const [sortBy, setSortBy] =
    useState<SortOption>("newest");

  const [visibleCount, setVisibleCount] =
    useState(PRODUCTS_PER_PAGE);

  /*
   * Build the available format options from
   * the current marketplace listings.
   */
  const formats = [
    "All",
    ...Array.from(
      new Set(
        products
          .map((product) => product.format)
          .filter(
            (format): format is string =>
              Boolean(format),
          ),
      ),
    ).sort((a, b) =>
      a.localeCompare(b),
    ),
  ];

  const search =
    searchTerm.trim().toLowerCase();

  /*
   * SEARCH + FORMAT FILTER
   */
  const filteredProducts = products.filter(
    (product) => {
      const matchesFormat =
        selectedFormat === "All" ||
        product.format === selectedFormat;

      const artist = String(
        product.artist ?? "",
      ).toLowerCase();

      const title = String(
        product.title ?? "",
      ).toLowerCase();

      const format = String(
        product.format ?? "",
      ).toLowerCase();

      const matchesSearch =
        search === "" ||
        artist.includes(search) ||
        title.includes(search) ||
        format.includes(search);

      return (
        matchesFormat &&
        matchesSearch
      );
    },
  );

  /*
   * SORTING
   *
   * Copy the array first so we don't mutate
   * the products passed into this component.
   */
  const sortedProducts = [
    ...filteredProducts,
  ];

  sortedProducts.sort((a, b) => {
    switch (sortBy) {
      case "artist-asc":
        return String(a.artist ?? "").localeCompare(
          String(b.artist ?? ""),
          undefined,
          {
            sensitivity: "base",
          },
        );

      case "artist-desc":
        return String(b.artist ?? "").localeCompare(
          String(a.artist ?? ""),
          undefined,
          {
            sensitivity: "base",
          },
        );

      case "title-asc":
        return String(a.title ?? "").localeCompare(
          String(b.title ?? ""),
          undefined,
          {
            sensitivity: "base",
          },
        );

      case "title-desc":
        return String(b.title ?? "").localeCompare(
          String(a.title ?? ""),
          undefined,
          {
            sensitivity: "base",
          },
        );

      case "price-asc":
        return (
          Number(a.price) -
          Number(b.price)
        );

      case "price-desc":
        return (
          Number(b.price) -
          Number(a.price)
        );

      case "format-asc":
        return String(
          a.format ?? "",
        ).localeCompare(
          String(b.format ?? ""),
          undefined,
          {
            sensitivity: "base",
          },
        );

      case "newest":
      default:
        /*
         * Preserve the newest-first order
         * supplied by page.tsx.
         */
        return 0;
    }
  });

  const visibleProducts =
    sortedProducts.slice(
      0,
      visibleCount,
    );

  const hasMore =
    visibleCount <
    sortedProducts.length;

  function handleSearch(
    value: string,
  ) {
    setSearchTerm(value);
    setVisibleCount(
      PRODUCTS_PER_PAGE,
    );
  }

  function handleFormat(
    value: string,
  ) {
    setSelectedFormat(value);
    setVisibleCount(
      PRODUCTS_PER_PAGE,
    );
  }

  function handleSort(
    value: SortOption,
  ) {
    setSortBy(value);
    setVisibleCount(
      PRODUCTS_PER_PAGE,
    );
  }

  return (
    <>
      {/* Search + Filter + Sort */}
      <div className="mb-10">
        <div className="grid gap-5 md:grid-cols-3">
          {/* Search */}
          <div>
            <label
              htmlFor="product-search"
              className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-500"
            >
              Search
            </label>

            <input
              id="product-search"
              type="text"
              value={searchTerm}
              onChange={(event) =>
                handleSearch(
                  event.target.value,
                )
              }
              placeholder="Search artist or title..."
              autoComplete="off"
              className="h-14 w-full border border-gray-300 bg-white px-5 text-sm outline-none transition focus:border-black"
            />
          </div>

          {/* Format Filter */}
          <div>
            <label
              htmlFor="format-filter"
              className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-500"
            >
              Filter by Format
            </label>

            <select
              id="format-filter"
              value={selectedFormat}
              onChange={(event) =>
                handleFormat(
                  event.target.value,
                )
              }
              className="h-14 w-full border border-gray-300 bg-white px-5 text-sm outline-none transition focus:border-black"
            >
              {formats.map((format) => (
                <option
                  key={format}
                  value={format}
                >
                  {format === "All"
                    ? "All Formats"
                    : format}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="sort-products"
              className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-500"
            >
              Sort By
            </label>

            <select
              id="sort-products"
              value={sortBy}
              onChange={(event) =>
                handleSort(
                  event.target
                    .value as SortOption,
                )
              }
              className="h-14 w-full border border-gray-300 bg-white px-5 text-sm outline-none transition focus:border-black"
            >
              <option value="newest">
                Newest First
              </option>

              <option value="artist-asc">
                Artist: A–Z
              </option>

              <option value="artist-desc">
                Artist: Z–A
              </option>

              <option value="title-asc">
                Title: A–Z
              </option>

              <option value="title-desc">
                Title: Z–A
              </option>

              <option value="price-asc">
                Price: Low to High
              </option>

              <option value="price-desc">
                Price: High to Low
              </option>

              <option value="format-asc">
                Format: A–Z
              </option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
          <p>
            {sortedProducts.length}{" "}
            {sortedProducts.length === 1
              ? "product"
              : "products"}{" "}
            found
          </p>

          {sortedProducts.length > 0 && (
            <p>
              Showing{" "}
              {visibleProducts.length}{" "}
              of{" "}
              {sortedProducts.length}
            </p>
          )}
        </div>
      </div>

      {/* No Results */}
      {sortedProducts.length === 0 ? (
        <div className="border border-gray-200 px-6 py-16 text-center">
          <p className="font-medium">
            No products found
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Try another artist, title, or format.
          </p>
        </div>
      ) : (
        <>
          {/* Products */}
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {visibleProducts.map(
              (product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  artist={
                    product.artist
                  }
                  title={
                    product.title
                  }
                  format={
                    product.format
                  }
                  price={
                    product.price
                  }
                  mediaCondition={
                    product.media_condition
                  }
                  imageUrl={
                    product.primary_image_url
                  }
                />
              ),
            )}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-14 flex justify-center">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount(
                    (current) =>
                      current +
                      PRODUCTS_PER_PAGE,
                  )
                }
                className="group flex min-w-56 items-center justify-center gap-3 bg-black px-8 py-4 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                <span>
                  Load More
                </span>

                <span
                  aria-hidden="true"
                  className="text-lg leading-none transition-transform group-hover:translate-y-1"
                >
                  ↓
                </span>
              </button>
            </div>
          )}

          {!hasMore &&
            sortedProducts.length >
              PRODUCTS_PER_PAGE && (
              <p className="mt-12 text-center text-sm text-gray-500">
                You&apos;ve reached the end of the results.
              </p>
            )}
        </>
      )}
    </>
  );
}