import { Suspense } from "react";
import { PlanBuilder } from "@/components/PlanBuilder";
import { createClient } from "@/lib/db/server";
import { loadWeek } from "@/lib/plans";
import { upcomingWeekStart } from "@/lib/weeks";

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

// Today in Austin as YYYY-MM-DD.
function austinToday(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

// Reads the signed-in user's plan for the coming week, so it renders at
// request time.
async function UpcomingWeek() {
  const supabase = await createClient();
  const weekStart = upcomingWeekStart(austinToday(new Date()));
  let week;
  try {
    week = await loadWeek(supabase, weekStart);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return <p role="alert">Couldn&apos;t load your plan: {message}</p>;
  }
  return <PlanBuilder weekStart={weekStart} initialWeek={week} />;
}
