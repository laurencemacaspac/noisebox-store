"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Seller = {
  id: number;
  user_id: string;
};

type Product = {
  id: number;
  seller_id: number;
  artist: string | null;
  title: string;
  format: string | null;
  price: number;
};

type ProductImage = {
  id: number;
  product_id: number;
  image_url: string;
  image_source: string | null;
  image_type: string | null;
  is_primary: boolean;
  sort_order: number | null;
};

export default function SellerProductEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const productId = Number(params.id);

  const [loading, setLoading] = useState(true);

  const [product, setProduct] =
    useState<Product | null>(null);

  const [images, setImages] =
    useState<ProductImage[]>([]);

  const [frontFile, setFrontFile] =
    useState<File | null>(null);

  const [backFile, setBackFile] =
    useState<File | null>(null);

  const [frontPreview, setFrontPreview] =
    useState<string | null>(null);

  const [backPreview, setBackPreview] =
    useState<string | null>(null);

  const [uploadingFront, setUploadingFront] =
    useState(false);

  const [uploadingBack, setUploadingBack] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setErrorMessage("");

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        setErrorMessage(
          "Invalid product ID.",
        );

        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      /*
       * Find the seller account belonging
       * to the logged-in user.
       */
      const {
        data: seller,
        error: sellerError,
      } = await supabase
        .from("sellers")
        .select("id, user_id")
        .eq("user_id", user.id)
        .maybeSingle<Seller>();

      if (sellerError) {
        setErrorMessage(
          sellerError.message,
        );

        setLoading(false);
        return;
      }

      if (!seller) {
        router.push("/seller");
        return;
      }

      /*
       * Important:
       * Seller can edit only THEIR product.
       */
      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select(
          `
            id,
            seller_id,
            artist,
            title,
            format,
            price
          `,
        )
        .eq("id", productId)
        .eq("seller_id", seller.id)
        .maybeSingle<Product>();

      if (productError) {
        setErrorMessage(
          productError.message,
        );

        setLoading(false);
        return;
      }

      if (!productData) {
        setErrorMessage(
          "Product not found or you do not have permission to edit it.",
        );

        setLoading(false);
        return;
      }

      setProduct(productData);

      await loadImages();

      setLoading(false);
    }

    loadProduct();
  }, [productId, router]);

  async function loadImages() {
    const {
      data,
      error,
    } = await supabase
      .from("product_images")
      .select(
        `
          id,
          product_id,
          image_url,
          image_source,
          image_type,
          is_primary,
          sort_order
        `,
      )
      .eq("product_id", productId)
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setImages(data ?? []);
  }

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
    type: "front" | "back",
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith("image/")
    ) {
      setErrorMessage(
        "Please select an image file.",
      );

      return;
    }

    /*
     * 10 MB limit for now.
     */
    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setErrorMessage(
        "Image must be smaller than 10 MB.",
      );

      return;
    }

    const preview =
      URL.createObjectURL(file);

    setErrorMessage("");
    setMessage("");

    if (type === "front") {
      if (frontPreview) {
        URL.revokeObjectURL(
          frontPreview,
        );
      }

      setFrontFile(file);
      setFrontPreview(preview);
    } else {
      if (backPreview) {
        URL.revokeObjectURL(
          backPreview,
        );
      }

      setBackFile(file);
      setBackPreview(preview);
    }
  }

  async function uploadArtwork(
    type: "front" | "back",
  ) {
    const file =
      type === "front"
        ? frontFile
        : backFile;

    if (!file) {
      setErrorMessage(
        `Choose a ${type} image first.`,
      );

      return;
    }

    if (!product) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage(
        "You must be logged in.",
      );

      return;
    }

    if (type === "front") {
      setUploadingFront(true);
    } else {
      setUploadingBack(true);
    }

    setErrorMessage("");
    setMessage("");

    try {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(
            /[^a-z0-9]/g,
            "",
          ) || "jpg";

      /*
       * Seller artwork is stored under:
       *
       * user-id/product-id/front-123.jpg
       */
      const filePath =
        `${user.id}/${product.id}/` +
        `${type}-${Date.now()}.${extension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("product-images")
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          },
        );

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const imageUrl =
        publicUrlData.publicUrl;

      /*
       * Check whether the seller already has
       * a manual image for this side.
       */
      const {
        data: existingSellerImage,
        error:
          existingSellerImageError,
      } = await supabase
        .from("product_images")
        .select("id")
        .eq(
          "product_id",
          product.id,
        )
        .eq(
          "image_source",
          "seller",
        )
        .eq(
          "image_type",
          type,
        )
        .order("id", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (
        existingSellerImageError
      ) {
        throw existingSellerImageError;
      }

      /*
       * FRONT seller image should become
       * the storefront's primary image.
       */
      if (type === "front") {
        const {
          error:
            primaryResetError,
        } = await supabase
          .from("product_images")
          .update({
            is_primary: false,
          })
          .eq(
            "product_id",
            product.id,
          );

        if (primaryResetError) {
          throw primaryResetError;
        }
      }

      if (existingSellerImage) {
        /*
         * Replace the database reference
         * for the existing seller image.
         */
        const {
          error: updateError,
        } = await supabase
          .from("product_images")
          .update({
            image_url: imageUrl,
            image_source:
              "seller",
            image_type: type,

            sort_order:
              type === "front"
                ? 0
                : 1,

            is_primary:
              type === "front",
          })
          .eq(
            "id",
            existingSellerImage.id,
          );

        if (updateError) {
          throw updateError;
        }
      } else {
        /*
         * No seller image exists yet,
         * so create one.
         */
        const {
          error: insertError,
        } = await supabase
          .from("product_images")
          .insert({
            product_id:
              product.id,

            image_url:
              imageUrl,

            image_source:
              "seller",

            image_type:
              type,

            sort_order:
              type === "front"
                ? 0
                : 1,

            is_primary:
              type === "front",
          });

        if (insertError) {
          throw insertError;
        }
      }

      await loadImages();

      if (type === "front") {
        if (frontPreview) {
          URL.revokeObjectURL(
            frontPreview,
          );
        }

        setFrontFile(null);
        setFrontPreview(null);
      } else {
        if (backPreview) {
          URL.revokeObjectURL(
            backPreview,
          );
        }

        setBackFile(null);
        setBackPreview(null);
      }

      setMessage(
        `${type === "front" ? "Front" : "Back"} artwork uploaded successfully.`,
      );
    } catch (error) {
      console.error(
        "Artwork upload error:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to upload artwork.",
      );
    } finally {
      if (type === "front") {
        setUploadingFront(false);
      } else {
        setUploadingBack(false);
      }
    }
  }

  const primaryImage =
    images.find(
      (image) =>
        image.is_primary,
    );

  const sellerFront =
    images.find(
      (image) =>
        image.image_source ===
          "seller" &&
        image.image_type ===
          "front",
    );

  const automaticFront =
    images.find(
      (image) =>
        image.image_source ===
          "cover_art_archive" &&
        image.image_type ===
          "front",
    );

  const displayedFront =
    sellerFront ??
    primaryImage ??
    automaticFront ??
    null;

  const sellerBack =
    images.find(
      (image) =>
        image.image_source ===
          "seller" &&
        image.image_type ===
          "back",
    );

  const automaticBack =
    images.find(
      (image) =>
        image.image_source ===
          "cover_art_archive" &&
        image.image_type ===
          "back",
    );

  const displayedBack =
    sellerBack ??
    automaticBack ??
    null;

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p>
          Loading product...
        </p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-bold">
          Product unavailable
        </h1>

        {errorMessage && (
          <p className="mt-4 text-red-600">
            {errorMessage}
          </p>
        )}

        <Link
          href="/seller"
          className="mt-8 inline-block underline"
        >
          Back to Seller Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link
        href="/seller"
        className="text-sm underline"
      >
        ← Seller Dashboard
      </Link>

      <div className="mt-8 border-b border-gray-200 pb-8">
        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
          Edit Product
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          {product.artist
            ? `${product.artist} — `
            : ""}
          {product.title}
        </h1>

        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
          {product.format && (
            <span>
              {product.format}
            </span>
          )}

          <span>
            $
            {Number(
              product.price,
            ).toFixed(2)}
          </span>

          <span>
            Product #{product.id}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-8 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="mt-8 border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-bold">
          Product Artwork
        </h2>

        <p className="mt-2 max-w-2xl text-gray-600">
          Seller-uploaded artwork takes priority over automatically matched cover artwork.
        </p>

        <div className="mt-8 grid gap-10 md:grid-cols-2">
          {/* FRONT */}
          <ArtworkPanel
            title="Front Cover"
            image={
              frontPreview ??
              displayedFront?.image_url ??
              null
            }
            source={
              frontPreview
                ? "New upload preview"
                : displayedFront
                  ? displayedFront.image_source ===
                    "seller"
                    ? "Seller upload"
                    : "Automatic artwork"
                  : "No image"
            }
          >
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                handleFileSelection(
                  event,
                  "front",
                )
              }
              className="block w-full text-sm"
            />

            <button
              type="button"
              disabled={
                !frontFile ||
                uploadingFront
              }
              onClick={() =>
                uploadArtwork(
                  "front",
                )
              }
              className="mt-4 w-full bg-black px-5 py-3 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {uploadingFront
                ? "Uploading..."
                : "Upload Front Cover"}
            </button>
          </ArtworkPanel>

          {/* BACK */}
          <ArtworkPanel
            title="Back Cover"
            image={
              backPreview ??
              displayedBack?.image_url ??
              null
            }
            source={
              backPreview
                ? "New upload preview"
                : displayedBack
                  ? displayedBack.image_source ===
                    "seller"
                    ? "Seller upload"
                    : "Automatic artwork"
                  : "No image"
            }
          >
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                handleFileSelection(
                  event,
                  "back",
                )
              }
              className="block w-full text-sm"
            />

            <button
              type="button"
              disabled={
                !backFile ||
                uploadingBack
              }
              onClick={() =>
                uploadArtwork(
                  "back",
                )
              }
              className="mt-4 w-full bg-black px-5 py-3 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {uploadingBack
                ? "Uploading..."
                : "Upload Back Cover"}
            </button>
          </ArtworkPanel>
        </div>
      </section>

      <section className="mt-12 border-t border-gray-200 pt-8">
        <h2 className="font-semibold">
          Image priority
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          A manually uploaded seller front cover becomes the primary storefront image.
          Automatic Cover Art Archive artwork remains available in the product gallery
          but will not override the seller&apos;s front cover.
        </p>
      </section>
    </main>
  );
}

function ArtworkPanel({
  title,
  image,
  source,
  children,
}: {
  title: string;
  image: string | null;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">
          {title}
        </h3>

        <span className="text-xs uppercase tracking-wider text-gray-500">
          {source}
        </span>
      </div>

      <div className="relative mt-5 aspect-square overflow-hidden bg-gray-100">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold text-gray-400">
                NOISEBOX
              </p>

              <p className="mt-2 text-sm text-gray-400">
                No cover available
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}