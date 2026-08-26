"use client";

import Image from "next/image";
import { useState } from "react";

type ProductImage = {
  id: number;
  image_url: string;
  image_type: "catalog" | "seller";
  is_primary: boolean;
  sort_order: number;
};

type ProductGalleryProps = {
  images: ProductImage[];
  productName: string;
  fallbackImage?: string | null;
};

export default function ProductGallery({
  images,
  productName,
  fallbackImage,
}: ProductGalleryProps) {
  const sortedImages = [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;

    return a.sort_order - b.sort_order;
  });

  const galleryImages =
    sortedImages.length > 0
      ? sortedImages
      : fallbackImage
        ? [
            {
              id: -1,
              image_url: fallbackImage,
              image_type: "catalog" as const,
              is_primary: true,
              sort_order: 0,
            },
          ]
        : [];

  const [selectedImageId, setSelectedImageId] = useState(
    galleryImages[0]?.id ?? null,
  );

  const selectedImage =
    galleryImages.find(
      (image) => image.id === selectedImageId,
    ) ?? galleryImages[0];

  if (!selectedImage) {
    return (
      <div className="flex aspect-square items-center justify-center bg-gray-100 p-8 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-gray-400">
            Noisebox
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Artwork coming soon
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <Image
          src={selectedImage.image_url}
          alt={productName}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
          priority
        />
      </div>

      {/* Thumbnails */}
      {galleryImages.length > 1 && (
        <div className="mt-4 grid grid-cols-5 gap-3">
          {galleryImages.map((image, index) => {
            const isSelected =
              image.id === selectedImage.id;

            return (
              <button
                key={image.id}
                type="button"
                onClick={() =>
                  setSelectedImageId(image.id)
                }
                className={`relative aspect-square overflow-hidden border bg-gray-100 transition ${
                  isSelected
                    ? "border-black"
                    : "border-gray-200 hover:border-gray-500"
                }`}
                aria-label={`View image ${index + 1}`}
              >
                <Image
                  src={image.image_url}
                  alt={`${productName} image ${index + 1}`}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}