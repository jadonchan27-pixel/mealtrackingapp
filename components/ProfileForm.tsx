"use client";

import { useState } from "react";
import { Targets } from "@/components/Targets";
import type { ActivityLevel, Sex } from "@/lib/db/types";
import {
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  type Profile,
  type ProfileErrors,
} from "@/lib/profile";
import type { Targets as TargetValues } from "@/lib/targets";
import { ftInToIn, inToFtIn } from "@/lib/units";

// Form fields hold what was typed, so they're strings until submit.
export type FormValues = {
  age: string;
  sex: Sex | "";
  feet: string;
  inches: string;
  weightLb: string;
  activityLevel: ActivityLevel | "";
  minIngredients: string;
  maxIngredients: string;
  maxMealCost: string;
  weeklyBudget: string;
};

export function toFormValues(profile: Profile | null): FormValues {
  if (!profile) {
    return {
      age: "",
      sex: "",
      feet: "",
      inches: "",
      weightLb: "",
      activityLevel: "",
      minIngredients: "",
      maxIngredients: "",
      maxMealCost: "",
      weeklyBudget: "",
    };
  }
  const { feet, inches } = inFtIn(profile.heightIn);
  return {
    age: String(profile.age),
    sex: profile.sex,
    feet: String(feet),
    inches: String(inches),
    weightLb: String(profile.weightLb),
    activityLevel: profile.activityLevel,
    minIngredients:
      profile.minIngredients === null ? "" : String(profile.minIngredients),
    maxIngredients:
      profile.maxIngredients === null ? "" : String(profile.maxIngredients),
    maxMealCost:
      profile.maxMealCost === null ? "" : String(profile.maxMealCost),
    weeklyBudget:
      profile.weeklyBudget === null ? "" : String(profile.weeklyBudget),
  };
}

// Inches are kept to one decimal place so the field doesn't show float noise.
function inFtIn(heightIn: number) {
  const { feet, inches } = inToFtIn(heightIn);
  return { feet, inches: Math.round(inches * 10) / 10 };
}

// Body for PUT /api/profile. Blank or non-numeric fields become NaN or "",
// which the API rejects with a message for that field.
export function toRequestBody(values: FormValues) {
  const feet = values.feet.trim() === "" ? Number.NaN : Number(values.feet);
  const inches = values.inches.trim() === "" ? 0 : Number(values.inches);
  return {
    age: toNumber(values.age),
    sex: values.sex,
    heightIn: ftInToIn(feet, inches),
    weightLb: toNumber(values.weightLb),
    activityLevel: values.activityLevel,
    // Blank means no limit.
    minIngredients: toLimit(values.minIngredients),
    maxIngredients: toLimit(values.maxIngredients),
    maxMealCost: toLimit(values.maxMealCost.replace(/^\s*\$/, "")),
    weeklyBudget: toLimit(values.weeklyBudget.replace(/^\s*\$/, "")),
  };
}

function toLimit(text: string): number | null {
  return text.trim() === "" ? null : Number(text);
}

function toNumber(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function ProfileForm({
  initialProfile,
  initialTargets,
}: {
  initialProfile: Profile | null;
  initialTargets: TargetValues | null;
}) {
  const [values, setValues] = useState(() => toFormValues(initialProfile));
  const [targets, setTargets] = useState(initialTargets);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus({ kind: "idle" });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // NaN isn't valid JSON, so send it as null.
        body: JSON.stringify(toRequestBody(values), (_, v) =>
          Number.isNaN(v) ? null : v,
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors(json.fields ?? {});
        setStatus({
          kind: "error",
          message: json.fields
            ? "Check the highlighted fields."
            : (json.error ?? "Couldn't save."),
        });
        return;
      }
      setErrors({});
      setTargets(json.targets);
      setValues(toFormValues(json.profile));
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server." });
    }
  }

  return (
    <div className="profile-layout">
      <form className="card profile-form" onSubmit={onSubmit} noValidate>
        <h2>About you</h2>

        <Field label="Age" error={errors.age} htmlFor="age">
          <input
            id="age"
            inputMode="numeric"
            value={values.age}
            onChange={(e) => set("age", e.target.value)}
            aria-invalid={!!errors.age}
          />
        </Field>

        <Field label="Sex" error={errors.sex} htmlFor="sex">
          <select
            id="sex"
            value={values.sex}
            onChange={(e) => set("sex", e.target.value as FormValues["sex"])}
            aria-invalid={!!errors.sex}
          >
            <option value="" disabled>
              Choose…
            </option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>

        <Field label="Height" error={errors.heightIn} htmlFor="feet">
          <div className="inline-inputs">
            <input
              id="feet"
              inputMode="numeric"
              value={values.feet}
              onChange={(e) => set("feet", e.target.value)}
              aria-label="Feet"
              aria-invalid={!!errors.heightIn}
            />
            <span>ft</span>
            <input
              id="inches"
              inputMode="decimal"
              value={values.inches}
              onChange={(e) => set("inches", e.target.value)}
              aria-label="Inches"
              aria-invalid={!!errors.heightIn}
            />
            <span>in</span>
          </div>
        </Field>

        <Field label="Weight" error={errors.weightLb} htmlFor="weight">
          <div className="inline-inputs">
            <input
              id="weight"
              inputMode="decimal"
              value={values.weightLb}
              onChange={(e) => set("weightLb", e.target.value)}
              aria-invalid={!!errors.weightLb}
            />
            <span>lb</span>
          </div>
        </Field>

        <Field label="Activity" error={errors.activityLevel} htmlFor="activity">
          <select
            id="activity"
            value={values.activityLevel}
            onChange={(e) =>
              set(
                "activityLevel",
                e.target.value as FormValues["activityLevel"],
              )
            }
            aria-invalid={!!errors.activityLevel}
          >
            <option value="" disabled>
              Choose…
            </option>
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {ACTIVITY_LABELS[level]}
              </option>
            ))}
          </select>
        </Field>

        <div className="field">
          <label htmlFor="min-ingredients">Ingredients per dish</label>
          <div className="inline-inputs">
            <input
              id="min-ingredients"
              inputMode="numeric"
              placeholder="any"
              aria-label="Fewest ingredients"
              value={values.minIngredients}
              onChange={(e) => set("minIngredients", e.target.value)}
              aria-invalid={!!errors.minIngredients}
            />
            <span>to</span>
            <input
              id="max-ingredients"
              inputMode="numeric"
              placeholder="any"
              aria-label="Most ingredients"
              value={values.maxIngredients}
              onChange={(e) => set("maxIngredients", e.target.value)}
              aria-invalid={!!errors.maxIngredients}
            />
          </div>
          <p className="muted field-hint">
            Recipe search only offers dishes in this range. Salt, pepper,
            cooking oil and water don&apos;t count. Leave blank for no limit.
          </p>
          {(errors.minIngredients || errors.maxIngredients) && (
            <p className="field-error">
              {errors.minIngredients ?? errors.maxIngredients}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="max-meal-cost">Most a meal can cost ($)</label>
          <input
            id="max-meal-cost"
            inputMode="numeric"
            placeholder="any"
            value={values.maxMealCost}
            onChange={(e) => set("maxMealCost", e.target.value)}
            aria-invalid={!!errors.maxMealCost}
          />
          <p className="muted field-hint">
            For the portion you&apos;ll eat. Recipe search leaves out dishes
            over this, unless too few fit. Leave blank for no limit.
          </p>
          {errors.maxMealCost && (
            <p className="field-error">{errors.maxMealCost}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="weekly-budget">Weekly grocery budget ($)</label>
          <input
            id="weekly-budget"
            inputMode="numeric"
            placeholder="none"
            value={values.weeklyBudget}
            onChange={(e) => set("weeklyBudget", e.target.value)}
            aria-invalid={!!errors.weeklyBudget}
          />
          <p className="muted field-hint">
            The plan and shopping list show the week&apos;s estimated cost
            against this. Leave blank for none.
          </p>
          {errors.weeklyBudget && (
            <p className="field-error">{errors.weeklyBudget}</p>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="primary"
            disabled={status.kind === "saving"}
          >
            {status.kind === "saving" ? "Saving…" : "Save"}
          </button>
          <p role="status" className="form-status">
            {status.kind === "saved" && "Saved."}
            {status.kind === "error" && status.message}
          </p>
        </div>
      </form>

      {targets ? (
        <Targets targets={targets} />
      ) : (
        <section className="card">
          <h2>Daily targets</h2>
          <p className="muted">Save your profile to see your targets.</p>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
