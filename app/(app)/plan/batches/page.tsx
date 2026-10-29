import Link from "next/link";
import { Suspense } from "react";
import { servingsLabel } from "@/components/FinalWeek";
import { RecipePhoto } from "@/components/RecipeFacts";
import { batchesForWeek, formatAmount, type Batch } from "@/lib/batches";
import { createClient } from "@/lib/db/server";
import { loadWeek } from "@/lib/plans";
import {
  austinToday,
  currentWeekStart,
  isSharedWeek,
  planSlotLabel,
  upcomingWeekStart,
} from "@/lib/weeks";

export default function BatchesPage() {
  return (
    <>
      <p>
        <Link href="/plan">← Plan</Link>
      </p>
      <h1>Batch cooking</h1>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <UpcomingBatches />
      </Suspense>
    </>
  );
}

// "Sun, Nov 1"
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Reads the signed-in user's finalized week, so it renders at request time.
// That's the coming week once it's finalized (Saturday, before the Sunday
// batch), otherwise the week under way (for its Thursday batch).
async function UpcomingBatches() {
  const supabase = await createClient();
  const today = austinToday(new Date());
  let batches: Batch[] | null = null;
  let message: string | null = null;
  try {
    for (const weekStart of [
      upcomingWeekStart(today),
      currentWeekStart(today),
    ]) {
      const week = await loadWeek(supabase, weekStart);
      if (week?.status === "final") {
        batches = await batchesForWeek(supabase, week);
        break;
      }
    }
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  if (message) {
    return <p role="alert">Couldn&apos;t load the batches: {message}</p>;
  }
  if (!batches) {
    return (
      <p className="muted">
        Finalize the coming week on the <Link href="/plan">Plan</Link> page to
        see what to cook.
      </p>
    );
  }
  return (
    <div className="plan-layout">
      {batches.map((b) => (
        <BatchSection key={b.batch} batch={b} />
      ))}
    </div>
  );
}

// US-12: one cooking session's recipes, scaled for the days it covers.
function BatchSection({ batch }: { batch: Batch }) {
  const headingId = `batch-${batch.batch}`;
  const shared = isSharedWeek({ items: batch.recipes });
  return (
    <section aria-labelledby={headingId} className="batch">
      <h2 id={headingId}>{batch.label}</h2>
      <p className="muted">
        {shortDate(batch.from)} to {shortDate(batch.to)} · {batch.days} days
      </p>
      {batch.recipes.map((r) => (
        <article key={r.slot} className="card batch-recipe">
          <RecipePhoto
            url={r.photoUrl}
            title={r.title}
            className="batch-photo"
          />
          <div>
            <p className="slot-label">{planSlotLabel(r.slot, shared)}</p>
            <h3>
              <Link href={`/recipes/${r.recipeId}`}>{r.title}</Link>
            </h3>
            <p className="recipe-meta">
              <span>Makes {formatAmount(r.servings)} servings</span>
              <span>
                {servingsLabel(r.servingsPerDay)} a day × {batch.days} days
              </span>
              <span>×{formatAmount(r.factor)} the recipe</span>
            </p>
          </div>
          <h4>Ingredients</h4>
          <ul className="ingredient-list">
            {r.ingredients.map((line, i) => (
              <li key={i}>
                {line.text}
                {line.grams !== null && line.grams > 0 && (
                  <span className="muted"> ({line.grams} g)</span>
                )}
              </li>
            ))}
          </ul>
          <details>
            <summary>Steps ({r.steps.length})</summary>
            <p className="muted">
              Amounts in the steps are for the original recipe; use the
              ingredients above.
            </p>
            <ol className="recipe-steps">
              {r.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </details>
        </article>
      ))}
    </section>
  );
}
