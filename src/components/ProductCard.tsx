import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  name: string;
  category: string;
  price: string;
  image: string;
  slug: string;
};

export default function ProductCard({
  name,
  category,
  price,
  image,
  slug,
}: ProductCardProps) {
  return (
    <Link href={`/products/${slug}`} className="block">
      <article className="group">
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        </div>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            {category}
          </p>

          <h3 className="mt-1 font-medium">{name}</h3>

          <p className="mt-1 text-sm">{price}</p>
        </div>
      </article>
    </Link>
  );
}