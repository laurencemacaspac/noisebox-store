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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <>
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            NOISEBOX
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            <Link href="/#shop" className="hover:text-gray-500">
              Shop
            </Link>

            <Link href="/#about" className="hover:text-gray-500">
              About
            </Link>

            {!authLoading && !user && (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="hover:text-gray-500"
              >
                Sign In
              </button>
            )}

            {!authLoading && user && (
              <>
                <Link href="/seller" className="hover:text-gray-500">
                  Sell
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
                  className="hover:text-gray-500"
                >
                  Sign Out
                </button>
              </>
            )}

            <Link href="/cart" className="hover:text-gray-500">
              Cart ({cartCount})
            </Link>
          </nav>
        </div>
      </header>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}