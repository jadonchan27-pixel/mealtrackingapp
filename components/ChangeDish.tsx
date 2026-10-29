"use client";

import Link from "next/link";
import { useState } from "react";
import { OwnRecipeForm } from "@/components/OwnRecipeForm";
import { RecipeFacts } from "@/components/RecipeFacts";
import type { MealSlot } from "@/lib/db/types";
import type { WeekView } from "@/lib/plans";

// US-36: changes a finalized week's dish, from today to Saturday, to another
// recipe from its shortlist or to Jadon's own.
export function ChangeDish({
  week,
  slot,
  onChange,
}: {
  week: WeekView;
  slot: MealSlot;
  onChange: (week: WeekView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const planned = new Set(week.items.map((i) => i.recipe.id));
  const options = week.candidates[slot].filter(
    (c) => !planned.has(c.recipe.id),
  );

  async function change(candidateId: number) {
    setBusy(candidateId);
    setError(null);
    try {
      const res = await fetch(`/api/weeks/${week.id}/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Couldn't change it.`);
      setOpen(false);
      onChange(json.week);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change it.");
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="change-dish"
        onClick={() => setOpen(true)}
      >
        Change this dish
      </button>
    );
  }
  return (
    <div className="change-dish-panel">
      <p className="muted">
        The change applies from today to Saturday. Days already past keep what
        was planned, and the shopping list is rebuilt.
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {options.length === 0 ? (
        <p className="muted">No other recipes on this dish&apos;s shortlist.</p>
      ) : (
        <ul className="change-options">
          {options.map((c) => (
            <li key={c.id} className="card">
              <h4>
                <Link href={`/recipes/${c.recipe.id}`}>{c.recipe.title}</Link>
              </h4>
              <RecipeFacts recipe={c.recipe} />
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => change(c.id)}
              >
                {busy === c.id ? "Changing…" : "Use this instead"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <OwnRecipeForm
        weekId={week.id}
        slot={slot}
        disabled={busy !== null}
        onSaved={(next) => {
          setOpen(false);
          onChange(next);
        }}
      />
      <button
        type="button"
        className="link-button"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
    </div>
  );
}
