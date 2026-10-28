import { Suspense } from "react";
import { PlanBuilder } from "@/components/PlanBuilder";
import { createClient } from "@/lib/db/server";
import { loadWeek } from "@/lib/plans";
import { targetsForProfile } from "@/lib/targets";
import { austinToday, upcomingWeekStart } from "@/lib/weeks";

export default function PlanPage() {
  return (
    <>
      <h1>Plan</h1>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <UpcomingWeek />
      </Suspense>
    </>
  );
}

// Reads the signed-in user's plan for the coming week, so it renders at
// request time.
async function UpcomingWeek() {
  const supabase = await createClient();
  const weekStart = upcomingWeekStart(austinToday(new Date()));
  let week;
  let profile;
  try {
    [week, profile] = await Promise.all([
      loadWeek(supabase, weekStart),
      supabase.from("profile").select("*").maybeSingle(),
    ]);
    if (profile.error) throw new Error(profile.error.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return <p role="alert">Couldn&apos;t load your plan: {message}</p>;
  }
  const targets = profile.data ? targetsForProfile(profile.data) : null;
  return (
    <PlanBuilder weekStart={weekStart} initialWeek={week} targets={targets} />
  );
}
