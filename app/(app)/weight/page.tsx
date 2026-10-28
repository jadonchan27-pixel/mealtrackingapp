import { Suspense } from "react";
import { WeightTracker } from "@/components/WeightTracker";
import { createClient } from "@/lib/db/server";
import { movingAverage } from "@/lib/trend";

export default function WeightPage() {
  return (
    <>
      <h1>Weight</h1>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <SavedWeights />
      </Suspense>
    </>
  );
}

// Reads the signed-in user's weigh-ins, so it renders at request time.
async function SavedWeights() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weight_entries")
    .select("date, weight_lb")
    .order("date", { ascending: true });
  if (error) {
    return (
      <p role="alert">Couldn&apos;t load your weigh-ins: {error.message}</p>
    );
  }
  const entries = movingAverage(
    data.map((row) => ({ date: row.date, weightLb: Number(row.weight_lb) })),
  );
  return <WeightTracker initialEntries={entries} />;
}
