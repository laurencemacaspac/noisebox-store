import Image from "next/image";
import { notFound } from "next/navigation";
import AddToCart from "@/components/AddToCart";
import { supabase } from "@/lib/supabase";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            {product.category}
          </p>

          <h1 className="mt-3 text-4xl font-bold">{product.name}</h1>

          <p className="mt-4 text-xl">
            ${Number(product.price).toFixed(2)}
          </p>

          <p className="mt-6 leading-7 text-gray-600">
            {product.description}
          </p>

          <AddToCart
            productId={product.id}
            productName={product.name}
            price={Number(product.price)}
            image={product.image}
          />
        </div>
      </div>
    </main>
  );
}