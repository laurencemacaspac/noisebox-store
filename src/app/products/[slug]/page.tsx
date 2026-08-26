import { notFound } from "next/navigation";
import AddToCart from "@/components/AddToCart";
import ProductGallery from "@/components/ProductGallery";
import { supabase } from "@/lib/supabase";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const { slug } = await params;

  const listingId = Number(slug);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    notFound();
  }

  /*
   * Marketplace listing
   *
   * seller_listings
   *   ├── releases
   *   │     └── release_images
   *   │
   *   └── sellers
   */
  const { data: listing, error } = await supabase
    .from("seller_listings")
    .select(
      `
        id,
        seller_id,
        release_id,
        price,
        quantity,
        media_condition,
        sleeve_condition,
        seller_note,
        status,
        accept_offer,

        seller:sellers!seller_listings_seller_id_fkey (
          id,
          shop_name,
          shop_slug,
          description
        ),

        release:releases!seller_listings_release_id_fkey (
          id,
          artist,
          title,
          format,
          format_quantity,
          label,
          catalog_number,
          source,
          source_release_id,

          release_images (
            id,
            image_url,
            image_source,
            image_type,
            is_primary,
            sort_order
          )
        )
      `,
    )
    .eq("id", listingId)
    .single();

  if (error || !listing) {
    console.error("Product listing error:", error);
    notFound();
  }

  /*
   * Safely normalize Supabase relationship shapes.
   */
  const release = Array.isArray(listing.release)
    ? listing.release[0]
    : listing.release;

  const seller = Array.isArray(listing.seller)
    ? listing.seller[0]
    : listing.seller;

  if (!release) {
    notFound();
  }

  const productName = release.artist
    ? `${release.artist} - ${release.title}`
    : release.title;

  /*
   * Sort shared release artwork.
   */
  const releaseImages = [
    ...(release.release_images ?? []),
  ].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  /*
   * Determine primary image.
   *
   * Priority:
   * 1. Primary image
   * 2. Front cover
   * 3. First available image
   */
  const primaryImage =
    releaseImages.find((image) => image.is_primary) ??
    releaseImages.find(
      (image) => image.image_type === "front",
    ) ??
    releaseImages[0] ??
    null;

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2">
          {/* Product Gallery */}
          <div>
            <ProductGallery
              images={releaseImages}
              productName={productName}
              fallbackImage={
                primaryImage?.image_url ?? null
              }
            />
          </div>

          {/* Product Information */}
          <div className="flex flex-col justify-center">
            {release.format && (
              <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
                {release.format}
              </p>
            )}

            {release.artist && (
              <p className="mt-5 text-lg font-medium text-gray-600">
                {release.artist}
              </p>
            )}

            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {release.title}
            </h1>

            <p className="mt-6 text-2xl font-semibold">
              ${Number(listing.price).toFixed(2)}
            </p>

            {/* Release + Listing Details */}
            <div className="mt-8 border-y border-gray-200 py-6">
              <dl className="space-y-4 text-sm">
                {release.label && (
                  <div className="flex justify-between gap-6">
                    <dt className="text-gray-500">
                      Label
                    </dt>

                    <dd className="text-right font-medium">
                      {release.label}
                    </dd>
                  </div>
                )}

                {release.catalog_number && (
                  <div className="flex justify-between gap-6">
                    <dt className="text-gray-500">
                      Catalog Number
                    </dt>

                    <dd className="text-right font-medium">
                      {release.catalog_number}
                    </dd>
                  </div>
                )}

                {listing.media_condition && (
                  <div className="flex justify-between gap-6">
                    <dt className="text-gray-500">
                      Media Condition
                    </dt>

                    <dd className="text-right font-medium">
                      {listing.media_condition}
                    </dd>
                  </div>
                )}

                {listing.sleeve_condition && (
                  <div className="flex justify-between gap-6">
                    <dt className="text-gray-500">
                      Sleeve Condition
                    </dt>

                    <dd className="text-right font-medium">
                      {listing.sleeve_condition}
                    </dd>
                  </div>
                )}

                <div className="flex justify-between gap-6">
                  <dt className="text-gray-500">
                    Quantity
                  </dt>

                  <dd className="text-right font-medium">
                    {listing.quantity}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Seller */}
            {seller && (
              <div className="mt-7 border-b border-gray-200 pb-7">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Sold By
                </p>

                <p className="mt-2 text-lg font-semibold">
                  {seller.shop_name}
                </p>

                {seller.description && (
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {seller.description}
                  </p>
                )}
              </div>
            )}

            {/* Seller Notes */}
            {listing.seller_note && (
              <div className="mt-7">
                <h2 className="text-sm font-semibold uppercase tracking-wider">
                  Seller Notes
                </h2>

                <p className="mt-3 leading-7 text-gray-600">
                  {listing.seller_note}
                </p>
              </div>
            )}

            {/* Add to Cart */}
            {listing.quantity > 0 &&
            listing.status === "for_sale" ? (
              <div className="mt-8">
                <AddToCart
                  productId={listing.id}
                  sellerId={listing.seller_id}
                  productName={productName}
                  price={Number(listing.price)}
                  image={
                    primaryImage?.image_url ?? ""
                  }
                  maxQuantity={listing.quantity}
                />
              </div>
            ) : (
              <div className="mt-8 bg-gray-100 px-5 py-4 text-sm font-medium">
                Currently unavailable
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}