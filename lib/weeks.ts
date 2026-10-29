// Weekly plan basics (US-7): week starts, meal slots, and the cuisine choice.

import type { MealSlot } from "@/lib/db/types";
import { isIsoDate } from "@/lib/weights";

export const MEAL_SLOTS: readonly MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

// US-33: the slots a new week plans. `lunch` holds the one dish eaten for
// both lunch and dinner; there's no snack. Weeks planned before keep all
// four slots.
export const PLAN_SLOTS: readonly MealSlot[] = ["breakfast", "lunch"];
export const SHARED_SLOT: MealSlot = "lunch";
export const SHARED_LABEL = "Lunch & dinner";

// Meals a plan slot's dish covers each day.
export function mealsPerDay(slot: MealSlot, shared: boolean): number {
  return shared && slot === SHARED_SLOT ? 2 : 1;
}

// A plan slot's label: the lunch slot reads "Lunch & dinner" in a week
// planned with a shared dish (one with no separate dinner).
export function planSlotLabel(slot: MealSlot, shared: boolean): string {
  return shared && slot === SHARED_SLOT ? SHARED_LABEL : SLOT_LABELS[slot];
}

// A week shares its lunch dish with dinner unless it planned a dinner.
export function isSharedWeek(week: {
  items: readonly { slot: MealSlot }[];
}): boolean {
  return !week.items.some((i) => i.slot === "dinner");
}

// TR-30: a dish changed after finalizing gets a new plan item and the old
// one stays for the days it was eaten. A slot's current item is the one for
// its picked recipe (the newest one if the picks no longer say).
export function currentItems<
  T extends { id: number; slot: MealSlot; recipe_id: number },
>(
  items: readonly T[],
  picks: readonly { slot: MealSlot; recipe_id: number }[],
): T[] {
  return items.filter((item) => {
    const mine = items.filter((i) => i.slot === item.slot);
    const pick = picks.find((p) => p.slot === item.slot);
    const picked = pick && mine.find((i) => i.recipe_id === pick.recipe_id);
    const current = picked ?? mine.reduce((a, b) => (b.id > a.id ? b : a));
    return current.id === item.id;
  });
}

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function isMealSlot(value: unknown): value is MealSlot {
  return MEAL_SLOTS.includes(value as MealSlot);
}

// Cuisines offered on the plan page, and the ones the app picks from when
// Jadon skips choosing. Any other cuisine can be typed in.
export const CUISINE_OPTIONS = [
  "American",
  "Mexican",
  "Italian",
  "Indian",
  "Chinese",
  "Thai",
  "Japanese",
  "Korean",
  "Mediterranean",
  "Greek",
  "Middle Eastern",
  "Vietnamese",
] as const;

export const MAX_CUISINES = 3;
const MAX_CUISINE_LENGTH = 40;

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function isSunday(iso: string): boolean {
  return isIsoDate(iso) && utcDate(iso).getUTCDay() === 0;
}

// Today in Austin as YYYY-MM-DD.
export function austinToday(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

// The week being planned: today when it's Sunday, else the coming Sunday
// (planning happens on Saturday for the week from Sunday).
export function upcomingWeekStart(today: string): string {
  const d = utcDate(today);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

// The week under way: the Sunday on or before `today`.
export function currentWeekStart(today: string): string {
  const d = utcDate(today);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

export type NewWeekInput = { weekStart: string; cuisines: string[] };
export type NewWeekErrors = Partial<Record<keyof NewWeekInput, string>>;

// POST /api/weeks body: { weekStart: "YYYY-MM-DD" (a Sunday), cuisines?: [] }.
// Cuisines are trimmed and de-duplicated; none means the app chooses.
export function parseNewWeek(
  body: unknown,
): { ok: true; week: NewWeekInput } | { ok: false; errors: NewWeekErrors } {
  const input = (
    typeof body === "object" && body !== null ? body : {}
  ) as Record<string, unknown>;
  const errors: NewWeekErrors = {};

  if (!isSunday(input.weekStart as string)) {
    errors.weekStart = "The week must start on a Sunday.";
  }

  const raw = input.cuisines ?? [];
  const cuisines: string[] = [];
  if (!Array.isArray(raw) || raw.some((c) => typeof c !== "string")) {
    errors.cuisines = "Cuisines must be a list of names.";
  } else {
    for (const c of raw as string[]) {
      const name = c.trim().replace(/\s+/g, " ");
      if (name === "") continue;
      if (name.length > MAX_CUISINE_LENGTH) {
        errors.cuisines = `Keep each cuisine under ${MAX_CUISINE_LENGTH} characters.`;
      }
      if (!cuisines.some((x) => x.toLowerCase() === name.toLowerCase())) {
        cuisines.push(name);
      }
    }
    if (cuisines.length > MAX_CUISINES) {
      errors.cuisines = `Choose up to ${MAX_CUISINES} cuisines.`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, week: { weekStart: input.weekStart as string, cuisines } };
}

// When no cuisine is chosen, the app picks one that wasn't used last week.
export function pickCuisine(
  lastWeek: readonly string[],
  random: () => number = Math.random,
): string {
  const used = new Set(lastWeek.map((c) => c.toLowerCase()));
  const fresh = CUISINE_OPTIONS.filter((c) => !used.has(c.toLowerCase()));
  const pool = fresh.length > 0 ? fresh : CUISINE_OPTIONS;
  return pool[Math.floor(random() * pool.length) % pool.length];
}
