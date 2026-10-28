import { Suspense } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/db/server";

export default function Home() {
  return (
    <main>
      <h1>Meal Tracking App</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <CurrentUser />
      </Suspense>
      <SignOutButton />
    </main>
  );
}

// Reads the session cookie, so it renders at request time behind Suspense.
async function CurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <p>Signed in as {user?.email}</p>;
}
