import ProductGrid from "@/components/ProductGrid";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: products, error } = await supabase
    .from("products_test")
    .select("*")
    .order("id", { ascending: true });

  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="mb-4 text-sm uppercase tracking-[0.25em] text-gray-500">
          Noisebox Store
        </p>

        <h1 className="max-w-4xl text-5xl font-bold leading-tight md:text-7xl">
          Independent music, apparel, posters, and design.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          Limited-run shirts, posters, accessories, and music-inspired goods
          from Noisebox.
        </p>

        <div className="mt-10">
          <a
            href="#shop"
            className="inline-block bg-black px-6 py-3 text-white transition hover:bg-gray-800"
          >
            Shop Products
          </a>
        </div>
      </section>

      <section
        id="shop"
        className="border-t border-gray-200 bg-gray-50 px-6 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
                The Shop
              </p>

              <h2 className="mt-2 text-3xl font-bold">Featured Products</h2>
            </div>

            <a href="#shop" className="text-sm underline">
              View all
            </a>
          </div>

          {error ? (
            <div className="border border-gray-200 bg-white p-8 text-center">
              <h3 className="text-xl font-semibold">
                Products are temporarily unavailable.
              </h3>

              <p className="mt-2 text-gray-600">
                We&apos;re having trouble loading the shop right now. Please
                try again shortly.
              </p>
            </div>
          ) : (
            <ProductGrid products={products ?? []} />
          )}
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            About
          </p>

          <h2 className="mt-3 text-3xl font-bold">
            Independent goods with a music-first point of view.
          </h2>

          <p className="mt-5 leading-7 text-gray-600">
            Noisebox Store is a collection of apparel, artwork, posters, and
            limited-run products inspired by independent music, design, and
            culture.
          </p>
        </div>
      </section>

      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-8 text-sm text-gray-500">
          <p>© 2026 Noisebox Store</p>
          <p>Built from scratch with Next.js</p>
        </div>
      </footer>
    </main>
  );
}