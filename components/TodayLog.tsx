"use client";

import Link from "next/link";
import { useState } from "react";
import { servingsLabel, type DailyTargets } from "@/components/FinalWeek";
import { RecipePhoto } from "@/components/RecipeFacts";
import {
  confirmedTotals,
  MAX_PORTION,
  PORTION_STEP,
  type DayEntry,
  type DayLog,
  type LogPatch,
  type Nutrition,
} from "@/lib/log";
import { SLOT_LABELS } from "@/lib/weeks";

const MACROS: { key: keyof Nutrition; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
];

// How full a target's bar is, 0 to 100.
export function percentOf(total: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.min(100, Math.round((total / target) * 100));
}

// The portion one step up or down, kept within ¼ to 10.
export function stepPortion(portion: number, direction: 1 | -1): number {
  const next = Math.round((portion + direction * PORTION_STEP) * 4) / 4;
  return Math.min(MAX_PORTION, Math.max(PORTION_STEP, next));
}

async function patchEntry(id: number, patch: LogPatch): Promise<DayEntry> {
  const res = await fetch(`/api/log/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.entry;
}

// US-20 to US-23: today's meals, each confirmed with a tap, and the totals
// of what's been confirmed against the targets.
export function TodayLog({
  initial,
  targets,
}: {
  initial: DayLog;
  targets: DailyTargets | null;
}) {
  const [entries, setEntries] = useState(initial.entries);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totals = confirmedTotals(entries);

  async function update(entry: DayEntry, patch: LogPatch) {
    setBusy(entry.id);
    setError(null);
    try {
      const saved = await patchEntry(entry.id, patch);
      setEntries((list) => list.map((e) => (e.id === saved.id ? saved : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="plan-layout">
      <section
        className="card"
        aria-labelledby="totals-heading"
        aria-live="polite"
      >
        <h2 id="totals-heading">Eaten so far</h2>
        <dl className="today-totals">
          {MACROS.map(({ key, label, unit }) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                <strong>{totals[key].toLocaleString("en-US")}</strong>
                {targets && ` / ${targets[key].toLocaleString("en-US")}`} {unit}
                {targets && (
                  <span className="today-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${percentOf(totals[key], targets[key])}%`,
                      }}
                    />
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {!targets && (
          <p className="muted">
            Save your <Link href="/profile">profile</Link> to see your targets.
          </p>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </section>

      {entries.length === 0 ? (
        <p className="muted">
          Nothing is planned for today. Finalize a week on the{" "}
          <Link href="/plan">Plan</Link> page.
        </p>
      ) : (
        entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            busy={busy === entry.id}
            onUpdate={(patch) => update(entry, patch)}
          />
        ))
      )}
    </div>
  );
}

function EntryCard({
  entry,
  busy,
  onUpdate,
}: {
  entry: DayEntry;
  busy: boolean;
  onUpdate: (patch: LogPatch) => void;
}) {
  const n = entry.nutrition;
  const amount =
    entry.kind === "planned"
      ? servingsLabel(entry.portion)
      : entry.portion === 1
        ? "the whole item"
        : `${entry.portion}× the item`;

  return (
    <article className={`card today-entry today-${entry.status}`}>
      <RecipePhoto
        url={entry.photoUrl}
        title={entry.title}
        className="today-photo"
      />
      <div className="today-body">
        <p className="slot-label">
          {SLOT_LABELS[entry.slot]}
          {entry.kind === "restaurant" &&
            ` · Eating out${entry.restaurantName ? ` at ${entry.restaurantName}` : ""}`}
        </p>
        <h3>
          {entry.recipeId ? (
            <Link href={`/recipes/${entry.recipeId}`}>{entry.title}</Link>
          ) : (
            entry.title
          )}
        </h3>
        <p className="recipe-meta">
          <span>{amount}</span>
          <span>{Math.round(n.kcal)} kcal</span>
          <span>{Math.round(n.proteinG)} g protein</span>
          <span>{Math.round(n.carbsG)} g carbs</span>
          <span>{Math.round(n.fatG)} g fat</span>
        </p>

        <div className="today-actions">
          {entry.status === "planned" && (
            <>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => onUpdate({ status: "confirmed" })}
              >
                Ate it
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onUpdate({ status: "skipped" })}
              >
                Skip
              </button>
            </>
          )}
          {entry.status === "confirmed" && (
            <>
              <span className="today-status">✓ Eaten</span>
              <span className="today-portion">
                <button
                  type="button"
                  aria-label="Less"
                  disabled={busy || entry.portion <= PORTION_STEP}
                  onClick={() =>
                    onUpdate({ portion: stepPortion(entry.portion, -1) })
                  }
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="More"
                  disabled={busy || entry.portion >= MAX_PORTION}
                  onClick={() =>
                    onUpdate({ portion: stepPortion(entry.portion, 1) })
                  }
                >
                  +
                </button>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onUpdate({ status: "skipped" })}
              >
                Skip
              </button>
              <button
                type="button"
                className="link-button"
                disabled={busy}
                onClick={() => onUpdate({ status: "planned" })}
              >
                Undo
              </button>
            </>
          )}
          {entry.status === "skipped" && (
            <>
              <span className="today-status">Skipped</span>
              <button
                type="button"
                className="link-button"
                disabled={busy}
                onClick={() => onUpdate({ status: "planned" })}
              >
                Undo
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
