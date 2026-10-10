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
  const [search, setSearch] = useState("");
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setAuthLoading(false);
    }
    loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!search.trim()) return;
    // Search UI only: preserve the existing marketplace without introducing untested filtering.
    window.location.href = "/#shop";
  }

  return (
    <>
      <header className="nb-header">
        <div className="nb-header-inner">
          <Link href="/" className="nb-logo">NOISEBOX<span>.</span></Link>
          <form className="nb-search" onSubmit={handleSearch} role="search">
            <label className="sr-only" htmlFor="nb-search-input">Search music</label>
            <span aria-hidden="true">⌕</span>
            <input id="nb-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records, CDs, merch, artists, labels..." />
          </form>
          <nav className="nb-nav" aria-label="Main navigation">
            <Link href="/#shop">Explore</Link>
            <Link href="/#shop">Music</Link>
            <Link href="/#shop">Merch</Link>
            <Link href="/seller">Sell</Link>
            <Link href="/cart" aria-label={`Cart with ${cartCount} items`}>Cart ({cartCount})</Link>
            {!authLoading && !user && <button type="button" onClick={() => setAuthOpen(true)}>Sign In</button>}
            {!authLoading && user && <>
              <Link href="/account">Account</Link>
              <button type="button" onClick={handleSignOut}>Sign Out</button>
            </>}
          </nav>
        </div>
      </header>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
