import Link from "next/link";
import { Suspense } from "react";
import { ShoppingListView } from "@/components/ShoppingList";
import { createClient } from "@/lib/db/server";
import { loadWeek } from "@/lib/plans";
import { shoppingListForWeek, type ShoppingList } from "@/lib/shopping";
import { austinToday, currentWeekStart, upcomingWeekStart } from "@/lib/weeks";

export default function ShoppingPage() {
  return (
    <>
      <h1>Shopping</h1>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <WeekList />
      </Suspense>
    </>
  );
}

// "Nov 1"
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// The list for the coming week once it's finalized (shopping on Saturday),
// otherwise the week under way. Reads the signed-in user's data, so it
// renders at request time.
async function WeekList() {
  const supabase = await createClient();
  const today = austinToday(new Date());
  let found: { weekStart: string; list: ShoppingList } | null = null;
  let message: string | null = null;
  try {
    for (const weekStart of [
      upcomingWeekStart(today),
      currentWeekStart(today),
    ]) {
      const week = await loadWeek(supabase, weekStart);
      if (week?.status === "final") {
        found = { weekStart, list: await shoppingListForWeek(supabase, week) };
        break;
      }
    }
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  if (message) {
    return <p role="alert">Couldn&apos;t load the list: {message}</p>;
  }
  if (!found) {
    return (
      <p className="muted">
        Finalize the coming week on the <Link href="/plan">Plan</Link> page to
        get its shopping list.
      </p>
    );
  }
  return (
    <>
      <p className="muted">Week of {shortDate(found.weekStart)}</p>
      <ShoppingListView initial={found.list} />
    </>
  );
}
