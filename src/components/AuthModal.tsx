"use client";

import {
  FormEvent,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({
  isOpen,
  onClose,
}: AuthModalProps) {
  const [mode, setMode] =
    useState<"register" | "login">(
      "register",
    );

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  if (!isOpen) {
    return null;
  }

  function resetMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  function switchMode(
    newMode: "register" | "login",
  ) {
    setMode(newMode);

    resetMessages();

    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    resetMessages();

    /*
     * Registration validation.
     */
    if (mode === "register") {
      if (
        password !== confirmPassword
      ) {
        setErrorMessage(
          "Passwords do not match.",
        );

        return;
      }

      if (password.length < 6) {
        setErrorMessage(
          "Password must be at least 6 characters.",
        );

        return;
      }
    }

    setLoading(true);

    /*
     * CREATE ACCOUNT
     */
    if (mode === "register") {
      try {
        const {
          data,
          error,
        } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        /*
         * Normally email confirmation is enabled,
         * so a session will not exist until the
         * customer confirms the email.
         */
        console.log(
          "Noisebox registration user:",
          data.user,
        );

        setSuccessMessage(
          "Account created. Check your email to confirm your account.",
        );
      } catch (error) {
        console.error(
          "Noisebox registration error:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to create your account.",
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    /*
     * SIGN IN
     */
    try {
      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email,
            password,
          },
        );

      if (error) {
        throw error;
      }

      /*
       * A successful password login should
       * return both a user and a session.
       */
      if (!data.user) {
        throw new Error(
          "Sign in succeeded, but no user was returned.",
        );
      }

      if (!data.session) {
        throw new Error(
          "Sign in succeeded, but no session was created.",
        );
      }

      console.log(
        "Noisebox login session:",
        data.session,
      );

      console.log(
        "Noisebox logged-in user:",
        data.user,
      );

      /*
       * Verify that the Supabase client can
       * immediately read the persisted session.
       */
      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData.session) {
        throw new Error(
          "Login succeeded, but the session could not be persisted.",
        );
      }

      console.log(
        "Noisebox persisted session:",
        sessionData.session,
      );

      /*
       * Close the modal.
       */
      onClose();

      /*
       * Reload the application so Header,
       * Seller Dashboard, and other components
       * all read the newly authenticated state.
       */
      window.location.reload();
    } catch (error) {
      console.error(
        "Noisebox sign-in error:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in.",
      );

      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-white p-8 shadow-xl">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-4 text-2xl text-gray-500 hover:text-black"
          aria-label="Close"
        >
          ×
        </button>

        <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
          Noisebox
        </p>

        <h2 className="mt-2 text-3xl font-bold">
          {mode === "register"
            ? "Create Account"
            : "Sign In"}
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          {mode === "register"
            ? "Create an account to buy or sell on Noisebox."
            : "Welcome back to Noisebox."}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-4"
        >
          {/* Email */}
          <div>
            <label
              htmlFor="auth-email"
              className="mb-1 block text-sm"
            >
              Email
            </label>

            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="auth-password"
              className="mb-1 block text-sm"
            >
              Password
            </label>

            <input
              id="auth-password"
              type="password"
              required
              autoComplete={
                mode === "register"
                  ? "new-password"
                  : "current-password"
              }
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />
          </div>

          {/* Confirm Password */}
          {mode === "register" && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="mb-1 block text-sm"
              >
                Confirm Password
              </label>

              <input
                id="auth-confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={
                  confirmPassword
                }
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                className="w-full border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="bg-green-50 p-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black px-5 py-3 text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "register"
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        {/* Switch Login/Register */}
        <div className="mt-6 text-center text-sm text-gray-600">
          {mode === "register" ? (
            <>
              Already have an
              account?{" "}
              <button
                type="button"
                onClick={() =>
                  switchMode(
                    "login",
                  )
                }
                className="font-medium text-black underline"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Noisebox?{" "}
              <button
                type="button"
                onClick={() =>
                  switchMode(
                    "register",
                  )
                }
                className="font-medium text-black underline"
              >
                Create account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}