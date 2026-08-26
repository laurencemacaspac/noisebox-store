import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  id: number;
  artist: string | null;
  title: string;
  format: string | null;
  price: number | string;
  mediaCondition: string | null;
  imageUrl: string | null;
};

export default function ProductCard({
  id,
  artist,
  title,
  format,
  price,
  mediaCondition,
  imageUrl,
}: ProductCardProps) {
  return (
    <Link href={`/products/${id}`} className="block">
      <article className="group">
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`${artist ? `${artist} - ` : ""}${title}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                  Noisebox
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Artwork coming soon
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          {format && (
            <p className="text-xs uppercase tracking-wider text-gray-500">
              {format}
            </p>
          )}

          {artist && (
            <p className="mt-2 text-sm font-medium">
              {artist}
            </p>
          )}

          <h3 className="mt-1 font-medium">
            {title}
          </h3>

          {mediaCondition && (
            <p className="mt-2 text-xs text-gray-500">
              Media: {mediaCondition}
            </p>
          )}

          <p className="mt-2 text-sm font-medium">
            ${Number(price).toFixed(2)}
          </p>
        </div>
      </article>
    </Link>
  );
}