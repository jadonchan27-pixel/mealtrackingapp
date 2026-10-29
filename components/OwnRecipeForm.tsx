"use client";

import { useState } from "react";
import type { MealSlot } from "@/lib/db/types";
import type { WeekView } from "@/lib/plans";

// US-35: Jadon's own recipe for a dish, entered by hand.
const FIELDS = [
  { key: "title", label: "Name", inputMode: "text", required: true },
  {
    key: "servings",
    label: "Servings it makes",
    inputMode: "decimal",
    required: true,
  },
  {
    key: "kcal",
    label: "Calories per serving",
    inputMode: "decimal",
    required: true,
  },
  {
    key: "proteinG",
    label: "Protein per serving (g)",
    inputMode: "decimal",
    required: true,
  },
  {
    key: "carbsG",
    label: "Carbs per serving (g)",
    inputMode: "decimal",
    required: true,
  },
  {
    key: "fatG",
    label: "Fat per serving (g)",
    inputMode: "decimal",
    required: true,
  },
  {
    key: "activeMinutes",
    label: "Cook time (minutes)",
    inputMode: "numeric",
    required: false,
  },
  {
    key: "costPerServing",
    label: "Cost per serving ($)",
    inputMode: "decimal",
    required: false,
  },
  { key: "sourceUrl", label: "Link", inputMode: "url", required: false },
] as const;

type Key = (typeof FIELDS)[number]["key"] | "ingredients" | "steps";
type Values = Record<Key, string>;

const EMPTY = Object.fromEntries(
  [...FIELDS.map((f) => f.key), "ingredients", "steps"].map((k) => [k, ""]),
) as Values;

// The API names the cost field by what it stores.
function errorFor(
  errors: Record<string, string>,
  key: Key,
): string | undefined {
  return key === "costPerServing" ? errors.costCentsPerServing : errors[key];
}

export function OwnRecipeForm({
  weekId,
  slot,
  disabled = false,
  onSaved,
}: {
  weekId: number;
  slot: MealSlot;
  disabled?: boolean;
  onSaved: (week: WeekView) => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: Key, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const id = (key: Key) => `own-${slot}-${key}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/weeks/${weekId}/custom-recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, ...values }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(json.errors ?? {});
        setMessage(json.error ?? `Couldn't save it (${res.status}).`);
        return;
      }
      setErrors({});
      setValues(EMPTY);
      onSaved(json.week);
    } catch {
      setMessage("Couldn't save it. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="own-recipe">
      <summary>Add my own recipe</summary>
      <form onSubmit={submit} noValidate>
        {FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={id(f.key)}>
              {f.label}
              {!f.required && <span className="muted"> (optional)</span>}
            </label>
            <input
              id={id(f.key)}
              inputMode={f.inputMode}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              aria-invalid={!!errorFor(errors, f.key)}
            />
            {errorFor(errors, f.key) && (
              <p className="field-error">{errorFor(errors, f.key)}</p>
            )}
          </div>
        ))}
        {(
          [
            ["ingredients", "Ingredients, one per line"],
            ["steps", "Steps, one per line"],
          ] as const
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={id(key)}>
              {label} <span className="muted">(optional)</span>
            </label>
            <textarea
              id={id(key)}
              rows={4}
              value={values[key]}
              onChange={(e) => set(key, e.target.value)}
              aria-invalid={!!errors[key]}
            />
            {errors[key] && <p className="field-error">{errors[key]}</p>}
          </div>
        ))}
        <p className="muted field-hint">
          Ingredients go on the shopping list; the calories and macros you enter
          are what the plan uses.
        </p>
        {message && (
          <p role="alert" className="field-error">
            {message}
          </p>
        )}
        <button type="submit" className="primary" disabled={disabled || saving}>
          {saving ? "Saving…" : "Use my recipe"}
        </button>
      </form>
    </details>
  );
}
