import { Suspense } from "react";
import { TodayLog } from "@/components/TodayLog";
import { createClient } from "@/lib/db/server";
import { loadDay } from "@/lib/log";
import { targetsForProfile } from "@/lib/targets";
import { austinToday } from "@/lib/weeks";

export default function TodayPage() {
  return (
    <>
      <h1>Today</h1>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <Today />
      </Suspense>
    </>
  );
}

// "Wednesday, Oct 28"
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Today in Austin, read for the signed-in user, so it renders at request
// time.
async function Today() {
  const supabase = await createClient();
  const date = austinToday(new Date());
  let day;
  let profile;
  try {
    [day, profile] = await Promise.all([
      loadDay(supabase, date),
      supabase.from("profile").select("*").maybeSingle(),
    ]);
    if (profile.error) throw new Error(profile.error.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return <p role="alert">Couldn&apos;t load today: {message}</p>;
  }
  return (
    <>
      <p className="muted">{longDate(date)}</p>
      <TodayLog
        initial={day}
        targets={profile.data ? targetsForProfile(profile.data) : null}
      />
    </>
  );
}
