"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { useCart } from "@/components/CartProvider";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const { cartItems } = useCart();

  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
      setAuthLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();

    setUser(null);

    window.location.href = "/";
  }

  return (
    <>
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            {/* Logo */}
            <div className="flex w-full items-center justify-center py-5 md:w-auto md:justify-start">
              <Link
                href="/"
                className="text-xl font-bold tracking-tight"
              >
                NOISEBOX
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex w-full items-center justify-center gap-5 border-t border-gray-100 py-4 text-sm md:w-auto md:gap-6 md:border-t-0 md:py-5">
              <Link
                href="/#shop"
                className="whitespace-nowrap hover:text-gray-500"
              >
                Shop
              </Link>

              <Link
                href="/#about"
                className="whitespace-nowrap hover:text-gray-500"
              >
                About
              </Link>

              {!authLoading && !user && (
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="whitespace-nowrap hover:text-gray-500"
                >
                  Sign In
                </button>
              )}

              {!authLoading && user && (
                <>
                  <Link
                    href="/account"
                    className="whitespace-nowrap hover:text-gray-500"
                  >
                    Account
                  </Link>

                  <span
                    className="hidden max-w-40 truncate text-gray-500 md:inline"
                    title={user.email}
                  >
                    {user.email}
                  </span>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="whitespace-nowrap hover:text-gray-500"
                  >
                    Sign Out
                  </button>
                </>
              )}

              <Link
                href="/cart"
                className="whitespace-nowrap hover:text-gray-500"
              >
                Cart ({cartCount})
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}