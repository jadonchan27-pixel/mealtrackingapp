import { Suspense } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { createClient } from "@/lib/db/server";
import { profileFromRow, roundTargets } from "@/lib/profile";
import { targetsForProfile } from "@/lib/targets";

export default function ProfilePage() {
  return (
    <>
      <h1>Profile</h1>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <SavedProfile />
      </Suspense>
    </>
  );
}

// Reads the signed-in user's row, so it renders at request time.
async function SavedProfile() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .maybeSingle();
  if (error) {
    return <p role="alert">Couldn&apos;t load your profile: {error.message}</p>;
  }
  return (
    <ProfileForm
      initialProfile={data ? profileFromRow(data) : null}
      initialTargets={data ? roundTargets(targetsForProfile(data)) : null}
    />
  );
}
