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
import type { MealSlot } from "@/lib/db/types";
import { MEAL_SLOTS, SLOT_LABELS } from "@/lib/weeks";

const MACROS: { key: keyof Nutrition; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
];

const QUARTERS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

// How much of a restaurant item was eaten: "the whole item", "½ the item",
// "1½× the item".
export function amountLabel(portion: number): string {
  if (portion === 1) return "the whole item";
  const whole = Math.floor(portion);
  const part = QUARTERS[portion - whole] ?? "";
  const amount = `${whole === 0 ? "" : whole}${part}` || String(portion);
  return portion < 1 ? `${amount} the item` : `${amount}× the item`;
}

// Planned meals that an eat-out replaced: they stay skipped until the eat-out
// is removed.
export function replacedSlots(entries: readonly DayEntry[]): Set<MealSlot> {
  return new Set(
    entries.filter((e) => e.kind === "restaurant").map((e) => e.slot),
  );
}

// "12.5" → 12.5; blank or not a number → null.
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

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
  // The slot the eat-out form is open for; "any" lets Jadon pick it.
  const [eatOut, setEatOut] = useState<MealSlot | "any" | null>(null);
  const totals = confirmedTotals(entries);
  const replaced = replacedSlots(entries);

  async function remove(entry: DayEntry) {
    setBusy(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/log/${entry.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't remove it.");
      setEntries(json.day.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove it.");
    } finally {
      setBusy(null);
    }
  }

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
            replaced={entry.kind === "planned" && replaced.has(entry.slot)}
            onUpdate={(patch) => update(entry, patch)}
            onEatOut={() => setEatOut(entry.slot)}
            onRemove={() => remove(entry)}
          />
        ))
      )}

      {eatOut ? (
        <EatOutForm
          date={initial.date}
          slot={eatOut}
          onSaved={(day) => {
            setEntries(day.entries);
            setEatOut(null);
          }}
          onCancel={() => setEatOut(null)}
        />
      ) : (
        <p>
          <button
            type="button"
            className="eat-out-button"
            onClick={() => setEatOut("any")}
          >
            Log eating out
          </button>
        </p>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  busy,
  replaced,
  onUpdate,
  onEatOut,
  onRemove,
}: {
  entry: DayEntry;
  busy: boolean;
  replaced: boolean;
  onUpdate: (patch: LogPatch) => void;
  onEatOut: () => void;
  onRemove: () => void;
}) {
  const n = entry.nutrition;
  const amount =
    entry.kind === "planned"
      ? servingsLabel(entry.portion)
      : amountLabel(entry.portion);

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
          {entry.kind === "restaurant" ? (
            <>
              <span className="today-status">✓ Eaten</span>
              <button type="button" disabled={busy} onClick={onRemove}>
                Remove
              </button>
            </>
          ) : replaced ? (
            <span className="today-status">Replaced by eating out</span>
          ) : (
            <PlannedActions
              entry={entry}
              busy={busy}
              onUpdate={onUpdate}
              onEatOut={onEatOut}
            />
          )}
        </div>
      </div>
    </article>
  );
}

function PlannedActions({
  entry,
  busy,
  onUpdate,
  onEatOut,
}: {
  entry: DayEntry;
  busy: boolean;
  onUpdate: (patch: LogPatch) => void;
  onEatOut: () => void;
}) {
  return (
    <>
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
          <button type="button" disabled={busy} onClick={onEatOut}>
            Ate out
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
          <button type="button" disabled={busy} onClick={onEatOut}>
            Ate out
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
    </>
  );
}

const AMOUNTS = [0.25, 0.5, 0.75, 1, 1.5, 2];

// US-24: the restaurant item that replaces a meal. Calories and macros are
// for the whole item, as a menu or nutrition site lists them.
function EatOutForm({
  date,
  slot,
  onSaved,
  onCancel,
}: {
  date: string;
  slot: MealSlot | "any";
  onSaved: (day: DayLog) => void;
  onCancel: () => void;
}) {
  const [chosenSlot, setChosenSlot] = useState<MealSlot>(
    slot === "any" ? "lunch" : slot,
  );
  const [restaurant, setRestaurant] = useState("");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState(1);
  const [values, setValues] = useState({
    kcal: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numbers = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, parseAmount(v)]),
    );
    if (Object.values(numbers).some((v) => v === null)) {
      setError("Enter calories, protein, carbs and fat as numbers.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/log/restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          slot: chosenSlot,
          restaurantName: restaurant,
          itemName: item,
          amount,
          ...numbers,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't save.");
      onSaved(json.day);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setSaving(false);
    }
  }

  const field = (key: keyof typeof values, label: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={values[key]}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        required
      />
    </label>
  );

  return (
    <form className="card eat-out-form" onSubmit={submit}>
      <h2>
        {slot === "any"
          ? "Eating out"
          : `Ate out for ${SLOT_LABELS[slot].toLowerCase()}`}
      </h2>
      {slot === "any" && (
        <label className="field">
          <span>Instead of</span>
          <select
            value={chosenSlot}
            onChange={(e) => setChosenSlot(e.target.value as MealSlot)}
          >
            {MEAL_SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>Restaurant</span>
        <input
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          placeholder="Torchy's Tacos"
        />
      </label>
      <label className="field">
        <span>What you ate</span>
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="Trailer Park taco"
          required
        />
      </label>
      <label className="field">
        <span>How much of it</span>
        <select
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        >
          {AMOUNTS.map((a) => (
            <option key={a} value={a}>
              {amountLabel(a)}
            </option>
          ))}
        </select>
      </label>
      <p className="field-hint">
        Calories and macros for the whole item, as the menu lists them.
      </p>
      <div className="eat-out-numbers">
        {field("kcal", "Calories")}
        {field("proteinG", "Protein (g)")}
        {field("carbsG", "Carbs (g)")}
        {field("fatG", "Fat (g)")}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="today-actions">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
