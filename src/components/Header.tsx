"use client";

import { useCart } from "@/components/CartProvider";
import Link from "next/link";

export default function Header() {
  const { cartItems } = useCart();

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="/" className="text-xl font-bold tracking-tight">
          NOISEBOX
        </a>

        <nav className="flex items-center gap-6 text-sm">
          <a href="#shop" className="hover:text-gray-500">
            Shop
          </a>

          <a href="#about" className="hover:text-gray-500">
            About
          </a>

          <a href="#account" className="hover:text-gray-500">
            Account
          </a>

          <Link href="/cart" className="hover:text-gray-500">
            Cart ({cartCount})
          </Link>
        </nav>
      </div>
    </header>
  );
}
