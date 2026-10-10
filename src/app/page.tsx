import ProductGrid from "@/components/ProductGrid";
import HeroSlideshow from "@/components/HeroSlideshow";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: listings, error } = await supabase
    .from("seller_listings")
    .select(`
      id, release_id, price, quantity, media_condition, sleeve_condition,
      seller_note, status, created_at,
      release:releases!seller_listings_release_id_fkey (
        id, artist, title, label, catalog_number, format, format_quantity,
        source, source_release_id,
        release_images (
          id, image_url, image_source, image_type, is_primary, sort_order
        )
      )
    `)
    .eq("status", "for_sale")
    .gt("quantity", 0)
    .order("created_at", { ascending: false });

  const products = (listings ?? []).flatMap((listing) => {
    const release = Array.isArray(listing.release) ? listing.release[0] : listing.release;
    if (!release) return [];
    const images = [...(release.release_images ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    const selectedImage =
      images.find((image) => image.is_primary) ??
      images.find((image) => image.image_type === "front") ??
      images[0] ?? null;
    return [{
      id: listing.id,
      release_id: release.id,
      artist: release.artist,
      title: release.title,
      format: release.format,
      label: release.label,
      catalog_number: release.catalog_number,
      source: release.source,
      source_release_id: release.source_release_id,
      price: listing.price,
      quantity: listing.quantity,
      media_condition: listing.media_condition,
      sleeve_condition: listing.sleeve_condition,
      seller_note: listing.seller_note,
      status: listing.status,
      primary_image_url: selectedImage?.image_url ?? null,
    }];
  });

  return (
    <main>
      {/* Only the original hero has been replaced. */}
      <HeroSlideshow />

      {/* Marketplace — unchanged */}
      <section id="shop" className="border-t border-gray-200 bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-gray-500">The Shop</p>
              <h2 className="mt-2 text-3xl font-bold">Music Marketplace</h2>
            </div>
            <a href="#shop" className="text-sm underline">View all</a>
          </div>
          {error ? (
            <div className="border border-gray-200 bg-white p-8 text-center">
              <h3 className="text-xl font-semibold">Products are temporarily unavailable.</h3>
              <p className="mt-2 text-gray-600">We&apos;re having trouble loading the shop right now. Please try again shortly.</p>
              {process.env.NODE_ENV === "development" && (
                <p className="mt-4 text-sm text-red-600">{error.message}</p>
              )}
            </div>
          ) : products.length === 0 ? (
            <div className="border border-gray-200 bg-white p-8 text-center">
              <h3 className="text-xl font-semibold">No listings available.</h3>
              <p className="mt-2 text-gray-600">Check back soon for new music.</p>
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </section>

      {/* About — unchanged */}
      <section id="about" className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">About</p>
          <h2 className="mt-3 text-3xl font-bold">A marketplace made for music collectors.</h2>
          <p className="mt-5 leading-7 text-gray-600">Noisebox brings buyers and sellers together to discover, collect, and sell vinyl, CDs, and other physical music releases.</p>
        </div>
      </section>

      {/* Footer — unchanged */}
      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-8 text-sm text-gray-500">
          <p>© 2026 Noisebox Store</p>
          <p>Built from scratch with Next.js</p>
        </div>
      </footer>
    </main>
  );
}
