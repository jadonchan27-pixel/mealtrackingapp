"use client";

import Link from "next/link";
import { useState } from "react";
import { FinalWeek, type DailyTargets } from "@/components/FinalWeek";
import { RecipeFacts, RecipePhoto } from "@/components/RecipeFacts";
import type { MealSlot } from "@/lib/db/types";
import type { CandidateView, WeekView } from "@/lib/plans";
import { costTag, type CostCap } from "@/lib/priceLimits";
import {
  CUISINE_OPTIONS,
  MAX_CUISINES,
  MEAL_SLOTS,
  SLOT_LABELS,
} from "@/lib/weeks";

// "Sunday, Nov 1"
export function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Picks across the four slots, e.g. 3 when one slot has no pick yet.
export function pickedCount(week: WeekView): number {
  return MEAL_SLOTS.filter((s) => week.candidates[s].some((c) => c.selected))
    .length;
}

// The confirm shown before starting a week over (US-29), with a warning when
// meals are already logged.
export function startOverMessage(
  week: Pick<WeekView, "weekStart" | "status" | "loggedMeals">,
): string {
  const cleared =
    week.status === "final"
      ? "the finalized plan, the shortlist and your picks"
      : "the shortlist and your picks";
  let message = `Start the week of ${weekLabel(week.weekStart)} over? This clears ${cleared}, and you choose cuisines again.`;
  if (week.loggedMeals > 0) {
    const meals =
      week.loggedMeals === 1 ? "1 meal" : `${week.loggedMeals} meals`;
    message += ` You've already logged ${meals} this week. Confirmed and skipped planned meals are cleared too; meals you ate out stay.`;
  }
  return message;
}

type SlotStatus =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "done"; pagesRead: number; skipped: number }
  | { kind: "error"; message: string };

async function readJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export function PlanBuilder({
  weekStart,
  initialWeek,
  targets,
  costCap = null,
  budgetCents = null,
}: {
  weekStart: string;
  initialWeek: WeekView | null;
  targets: DailyTargets | null;
  // US-31, US-32: the profile's price limits, if set.
  costCap?: CostCap | null;
  budgetCents?: number | null;
}) {
  const [week, setWeek] = useState(initialWeek);
  const [editingCuisines, setEditingCuisines] = useState(initialWeek === null);

  function startedOver() {
    setWeek(null);
    setEditingCuisines(true);
  }

  if (week && week.status === "final") {
    return (
      <>
        <FinalWeek
          week={week}
          targets={targets}
          weekLabel={weekLabel(weekStart)}
          budgetCents={budgetCents}
        />
        <section className="card">
          <StartOver week={week} onReset={startedOver} />
        </section>
      </>
    );
  }

  return (
    <div className="plan-layout">
      {editingCuisines || !week ? (
        <CuisinePicker
          weekStart={weekStart}
          initial={week?.cuisines ?? []}
          onSaved={(saved) => {
            setWeek(saved);
            setEditingCuisines(false);
          }}
          onCancel={week ? () => setEditingCuisines(false) : undefined}
        />
      ) : (
        <Shortlist
          week={week}
          costCap={costCap}
          onChange={setWeek}
          onEditCuisines={() => setEditingCuisines(true)}
          onReset={startedOver}
        />
      )}
    </div>
  );
}

// US-29: deletes the week's plan after a confirm, so cuisines can be chosen
// again.
function StartOver({
  week,
  disabled = false,
  onReset,
}: {
  week: WeekView;
  disabled?: boolean;
  onReset: () => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOver() {
    if (!window.confirm(startOverMessage(week))) return;
    setResetting(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/weeks/${week.id}/reset`, { method: "POST" }),
      );
      onReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start over.");
      setResetting(false);
    }
  }

  return (
    <div className="start-over">
      <button
        type="button"
        disabled={disabled || resetting}
        onClick={startOver}
      >
        {resetting ? "Starting over…" : "Start over"}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function CuisinePicker({
  weekStart,
  initial,
  onSaved,
  onCancel,
}: {
  weekStart: string;
  initial: string[];
  onSaved: (week: WeekView) => void;
  onCancel?: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>(initial);
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isChosen = (c: string) =>
    chosen.some((x) => x.toLowerCase() === c.toLowerCase());
  const full = chosen.length >= MAX_CUISINES;

  function toggle(c: string) {
    setChosen((list) =>
      isChosen(c)
        ? list.filter((x) => x.toLowerCase() !== c.toLowerCase())
        : list.length < MAX_CUISINES
          ? [...list, c]
          : list,
    );
  }

  function addOther() {
    const name = other.trim().replace(/\s+/g, " ");
    if (name !== "" && !isChosen(name) && !full) setChosen([...chosen, name]);
    setOther("");
  }

  async function save(cuisines: string[]) {
    setSaving(true);
    setError(null);
    try {
      const json = await readJson(
        await fetch("/api/weeks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart, cuisines }),
        }),
      );
      onSaved(json.week);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const extras = chosen.filter(
    (c) => !CUISINE_OPTIONS.some((o) => o.toLowerCase() === c.toLowerCase()),
  );

  return (
    <section className="card" aria-labelledby="cuisine-heading">
      <h2 id="cuisine-heading">
        Cuisines for the week of {weekLabel(weekStart)}
      </h2>
      <p className="muted">
        Choose up to {MAX_CUISINES}, or skip and the app picks one you
        didn&apos;t have last week.
      </p>
      <div className="chips" role="group" aria-label="Cuisines">
        {[...CUISINE_OPTIONS, ...extras].map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={isChosen(c)}
            disabled={!isChosen(c) && full}
            onClick={() => toggle(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="other-cuisine">Another cuisine</label>
        <div className="inline-inputs">
          <input
            id="other-cuisine"
            value={other}
            maxLength={40}
            disabled={full}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOther();
              }
            }}
          />
          <button
            type="button"
            onClick={addOther}
            disabled={full || other.trim() === ""}
          >
            Add
          </button>
        </div>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="primary"
          disabled={saving || chosen.length === 0}
          onClick={() => save(chosen)}
        >
          {saving ? "Saving…" : "Use these cuisines"}
        </button>
        <button type="button" disabled={saving} onClick={() => save([])}>
          Let the app choose
        </button>
        {onCancel && (
          <button type="button" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}

function Shortlist({
  week,
  costCap,
  onChange,
  onEditCuisines,
  onReset,
}: {
  week: WeekView;
  costCap: CostCap | null;
  onChange: (week: WeekView) => void;
  onEditCuisines: () => void;
  onReset: () => void;
}) {
  const [status, setStatus] = useState<Partial<Record<MealSlot, SlotStatus>>>(
    {},
  );
  const [runningAll, setRunningAll] = useState(false);
  const searching = Object.values(status).some((s) => s.kind === "searching");

  const setSlot = (slot: MealSlot, candidates: CandidateView[]) =>
    onChange({
      ...week,
      candidates: { ...week.candidates, [slot]: candidates },
    });

  // Each slot is one request of about a minute, so slots run one at a time.
  async function search(slot: MealSlot, current: WeekView): Promise<WeekView> {
    setStatus((s) => ({ ...s, [slot]: { kind: "searching" } }));
    try {
      const json = await readJson(
        await fetch(`/api/weeks/${current.id}/candidates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot }),
        }),
      );
      const next = {
        ...current,
        candidates: { ...current.candidates, [slot]: json.candidates },
      };
      onChange(next);
      setStatus((s) => ({
        ...s,
        [slot]: {
          kind: "done",
          pagesRead: json.pagesRead,
          skipped: json.skipped.length,
        },
      }));
      return next;
    } catch (err) {
      setStatus((s) => ({
        ...s,
        [slot]: {
          kind: "error",
          message: err instanceof Error ? err.message : "Search failed.",
        },
      }));
      return current;
    }
  }

  async function searchEmptySlots() {
    setRunningAll(true);
    let current = week;
    for (const slot of MEAL_SLOTS) {
      if (current.candidates[slot].length === 0) {
        current = await search(slot, current);
      }
    }
    setRunningAll(false);
  }

  const empty = MEAL_SLOTS.filter((s) => week.candidates[s].length === 0);
  const picked = pickedCount(week);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // US-11: scales the picks to the targets and fixes the week's plan.
  async function finalize() {
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const json = await readJson(
        await fetch(`/api/weeks/${week.id}/finalize`, { method: "POST" }),
      );
      onChange(json.week);
    } catch (err) {
      setFinalizeError(
        err instanceof Error ? err.message : "Couldn't finalize.",
      );
      setFinalizing(false);
    }
  }

  return (
    <>
      <section className="card plan-summary">
        <h2>Week of {weekLabel(week.weekStart)}</h2>
        <p>
          Cuisines: <strong>{week.cuisines.join(", ")}</strong>{" "}
          <button
            type="button"
            className="link-button"
            disabled={searching}
            onClick={onEditCuisines}
          >
            Change
          </button>
        </p>
        <p className="muted">
          {picked} of {MEAL_SLOTS.length} meals picked.
          {empty.length > 0 &&
            " Each search reads up to 20 recipe pages and takes about a minute."}
        </p>
        {empty.length > 0 && (
          <button
            type="button"
            className="primary"
            disabled={searching}
            onClick={searchEmptySlots}
          >
            {runningAll
              ? "Finding recipes…"
              : empty.length === MEAL_SLOTS.length
                ? "Find recipes for every meal"
                : `Find recipes for the other ${empty.length === 1 ? "meal" : `${empty.length} meals`}`}
          </button>
        )}
        {picked === MEAL_SLOTS.length && (
          <button
            type="button"
            className="primary"
            disabled={searching || finalizing}
            onClick={finalize}
          >
            {finalizing ? "Finalizing…" : "Finalize the week"}
          </button>
        )}
        {finalizeError && (
          <p role="alert" className="field-error">
            {finalizeError}
          </p>
        )}
        <StartOver
          week={week}
          disabled={searching || finalizing}
          onReset={onReset}
        />
      </section>

      {MEAL_SLOTS.map((slot) => (
        <SlotSection
          key={slot}
          slot={slot}
          candidates={week.candidates[slot]}
          costCap={costCap}
          status={status[slot] ?? { kind: "idle" }}
          busy={searching}
          onSearch={() => search(slot, week)}
          onPicked={(candidates) => setSlot(slot, candidates)}
        />
      ))}
    </>
  );
}

function SlotSection({
  slot,
  candidates,
  costCap,
  status,
  busy,
  onSearch,
  onPicked,
}: {
  slot: MealSlot;
  candidates: CandidateView[];
  costCap: CostCap | null;
  status: SlotStatus;
  busy: boolean;
  onSearch: () => void;
  onPicked: (candidates: CandidateView[]) => void;
}) {
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);

  async function pick(id: number) {
    setPicking(id);
    setPickError(null);
    try {
      const json = await readJson(
        await fetch(`/api/candidates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selected: true }),
        }),
      );
      onPicked(json.candidates);
    } catch (err) {
      setPickError(err instanceof Error ? err.message : "Couldn't pick it.");
    } finally {
      setPicking(null);
    }
  }

  const headingId = `slot-${slot}`;
  return (
    <section className="slot" aria-labelledby={headingId}>
      <div className="slot-header">
        <h2 id={headingId}>{SLOT_LABELS[slot]}</h2>
        <button type="button" disabled={busy} onClick={onSearch}>
          {status.kind === "searching"
            ? "Searching…"
            : candidates.length === 0
              ? "Find recipes"
              : "Search again"}
        </button>
      </div>
      <p role="status" className="form-status">
        {status.kind === "searching" &&
          "Reading recipe pages. This takes about a minute."}
        {status.kind === "done" &&
          `Read ${status.pagesRead} pages; ${status.skipped} couldn't be used.`}
        {status.kind === "done" &&
          candidates.length === 0 &&
          " None fit (an hour or less of active cooking, with nutrition). Try another cuisine."}
      </p>
      {status.kind === "error" && (
        <p role="alert" className="field-error">
          {status.message}
        </p>
      )}
      {pickError && (
        <p role="alert" className="field-error">
          {pickError}
        </p>
      )}
      {candidates.length > 0 && (
        <ul className="candidates">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="card candidate"
              data-selected={c.selected || undefined}
            >
              <RecipePhoto
                url={c.recipe.photoUrl}
                title={c.recipe.title}
                className="candidate-photo"
              />
              <h3>
                <Link href={`/recipes/${c.recipe.id}`}>{c.recipe.title}</Link>
              </h3>
              <RecipeFacts recipe={c.recipe} />
              {costCap && (
                <CostTag slot={slot} cap={costCap} recipe={c.recipe} />
              )}
              <details>
                <summary>
                  Ingredients ({c.recipe.ingredients.length}), serves{" "}
                  {c.recipe.servings}
                </summary>
                <ul className="ingredient-list">
                  {c.recipe.ingredients.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
              {c.selected ? (
                <p className="picked-badge">✓ Picked</p>
              ) : (
                <button
                  type="button"
                  disabled={busy || picking !== null}
                  onClick={() => pick(c.id)}
                >
                  {picking === c.id ? "Picking…" : "Pick this instead"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// TR-25: "price unknown" or "$1.20 over" under a cost cap.
function CostTag({
  slot,
  cap,
  recipe,
}: {
  slot: MealSlot;
  cap: CostCap;
  recipe: CandidateView["recipe"];
}) {
  const tag = costTag(
    { kcal: recipe.kcal, cost_cents_per_serving: recipe.costCentsPerServing },
    slot,
    cap,
  );
  return tag ? <p className="cost-tag">{tag}</p> : null;
}
