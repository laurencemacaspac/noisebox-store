import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export type SellerAccount = {
  id: number;
  user_id: string;
  shop_name: string;
  shop_slug: string;
  description: string | null;
};

export type SellerAuthResult = {
  user: User | null;
  seller: SellerAccount | null;
};

/*
 * Returns the currently authenticated Supabase
 * user and, if one exists, the seller account
 * belonging to that user.
 *
 * We use getSession() first because getUser()
 * can throw AuthSessionMissingError after the
 * user signs out and no session exists.
 */
export async function getSellerAuth(): Promise<SellerAuthResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error(
      "Unable to load authentication session:",
      sessionError,
    );

    return {
      user: null,
      seller: null,
    };
  }

  /*
   * No session is a normal state.
   *
   * This happens when:
   * - the visitor isn't signed in
   * - the user just signed out
   *
   * Do not call getUser() when there is no
   * session.
   */
  if (!session) {
    return {
      user: null,
      seller: null,
    };
  }

  /*
   * Now that we know a session exists, ask
   * Supabase to verify and return the user.
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error(
      "Unable to load authenticated user:",
      userError,
    );

    return {
      user: null,
      seller: null,
    };
  }

  /*
   * Find the seller account associated with
   * this authenticated user's UUID.
   */
  const {
    data: seller,
    error: sellerError,
  } = await supabase
    .from("sellers")
    .select(
      `
      id,
      user_id,
      shop_name,
      shop_slug,
      description
    `,
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (sellerError) {
    console.error(
      "Unable to load seller account:",
      sellerError,
    );

    return {
      user,
      seller: null,
    };
  }

  return {
    user,
    seller:
      (seller as SellerAccount | null) ??
      null,
  };
}