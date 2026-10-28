"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/browser";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is redirected to Google, so only errors land here.
    if (error) {
      setError(error.message);
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={signIn} disabled={pending}>
        {pending ? "Redirecting…" : "Sign in with Google"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
