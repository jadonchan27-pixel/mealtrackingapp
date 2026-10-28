// The daily log (US-20 to US-23, TR-18): a day's planned and restaurant
// entries with their nutrition, and the day's totals, which count confirmed
// entries only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  LogEntryRow,
  LogKind,
  LogStatus,
  MealSlot,
} from "@/lib/db/types";
import { MEAL_SLOTS } from "@/lib/weeks";

type Supabase = SupabaseClient<Database>;

export type Nutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type DayEntry = {
  id: number;
  date: string;
  slot: MealSlot;
  kind: LogKind;
  status: LogStatus;
  // Servings eaten (planned) or the amount of the restaurant item.
  portion: number;
  title: string;
  recipeId: number | null;
  photoUrl: string | null;
  restaurantName: string | null;
  // One serving (planned) or the item as entered (restaurant).
  perPortion: Nutrition;
  // perPortion × portion.
  nutrition: Nutrition;
};

export type DayLog = {
  date: string;
  entries: DayEntry[];
  // Confirmed entries only (US-21).
  totals: Nutrition;
};

const ZERO: Nutrition = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

function times(n: Nutrition, portion: number): Nutrition {
  return {
    kcal: n.kcal * portion,
    proteinG: n.proteinG * portion,
    carbsG: n.carbsG * portion,
    fatG: n.fatG * portion,
  };
}

// The day's totals: confirmed entries only, rounded to whole units.
export function confirmedTotals(
  entries: readonly Pick<DayEntry, "status" | "nutrition">[],
): Nutrition {
  const sum = entries
    .filter((e) => e.status === "confirmed")
    .reduce(
      (t, e) => ({
        kcal: t.kcal + e.nutrition.kcal,
        proteinG: t.proteinG + e.nutrition.proteinG,
        carbsG: t.carbsG + e.nutrition.carbsG,
        fatG: t.fatG + e.nutrition.fatG,
      }),
      ZERO,
    );
  return {
    kcal: Math.round(sum.kcal),
    proteinG: Math.round(sum.proteinG),
    carbsG: Math.round(sum.carbsG),
    fatG: Math.round(sum.fatG),
  };
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Entries with their recipe (planned) or stored item (restaurant), in slot
// order, a planned entry before the restaurant item that replaced it.
async function entryViews(
  supabase: Supabase,
  rows: readonly LogEntryRow[],
): Promise<DayEntry[]> {
  const itemIds = [
    ...new Set(
      rows.map((r) => r.plan_item_id).filter((id): id is number => id !== null),
    ),
  ];
  const items =
    itemIds.length === 0
      ? []
      : (check(
          await supabase
            .from("plan_items")
            .select("id, recipe_id")
            .in("id", itemIds),
        ) ?? []);
  const recipeIds = [...new Set(items.map((i) => i.recipe_id))];
  const recipes =
    recipeIds.length === 0
      ? []
      : (check(
          await supabase
            .from("recipes")
            .select("id, title, photo_url, kcal, protein_g, carbs_g, fat_g")
            .in("id", recipeIds),
        ) ?? []);

  const views = rows.map((row): DayEntry => {
    const portion = Number(row.portion);
    if (row.kind === "restaurant") {
      const perPortion = {
        kcal: Number(row.kcal ?? 0),
        proteinG: Number(row.protein_g ?? 0),
        carbsG: Number(row.carbs_g ?? 0),
        fatG: Number(row.fat_g ?? 0),
      };
      return {
        id: row.id,
        date: row.date,
        slot: row.slot,
        kind: row.kind,
        status: row.status,
        portion,
        title: row.item_name ?? "Restaurant meal",
        recipeId: null,
        photoUrl: null,
        restaurantName: row.restaurant_name,
        perPortion,
        nutrition: times(perPortion, portion),
      };
    }
    const item = items.find((i) => i.id === row.plan_item_id);
    const recipe = item && recipes.find((r) => r.id === item.recipe_id);
    const perPortion = recipe
      ? {
          kcal: Number(recipe.kcal ?? 0),
          proteinG: Number(recipe.protein_g ?? 0),
          carbsG: Number(recipe.carbs_g ?? 0),
          fatG: Number(recipe.fat_g ?? 0),
        }
      : ZERO;
    return {
      id: row.id,
      date: row.date,
      slot: row.slot,
      kind: row.kind,
      status: row.status,
      portion,
      title: recipe?.title ?? "Planned meal",
      recipeId: recipe?.id ?? null,
      photoUrl: recipe?.photo_url ?? null,
      restaurantName: null,
      perPortion,
      nutrition: times(perPortion, portion),
    };
  });
  return views.sort(
    (a, b) =>
      MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot) ||
      Number(a.kind === "restaurant") - Number(b.kind === "restaurant") ||
      a.id - b.id,
  );
}

// US-20, US-23: the day's entries and confirmed totals.
export async function loadDay(
  supabase: Supabase,
  date: string,
): Promise<DayLog> {
  const rows =
    check(await supabase.from("log_entries").select("*").eq("date", date)) ??
    [];
  const entries = await entryViews(supabase, rows);
  return { date, entries, totals: confirmedTotals(entries) };
}

export type LogPatch = { status?: LogStatus; portion?: number };

export const PORTION_STEP = 0.25;
export const MAX_PORTION = 10;

const STATUSES: readonly LogStatus[] = ["planned", "confirmed", "skipped"];

// `{ status }` and/or `{ portion }` (quarters, 0.25 to 10).
export function parseLogPatch(
  body: unknown,
): { ok: true; patch: LogPatch } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Send { status } or { portion }." };
  }
  const { status, portion } = body as Record<string, unknown>;
  const patch: LogPatch = {};
  if (status !== undefined) {
    if (!STATUSES.includes(status as LogStatus)) {
      return {
        ok: false,
        error: "status must be planned, confirmed or skipped.",
      };
    }
    patch.status = status as LogStatus;
  }
  if (portion !== undefined) {
    if (
      typeof portion !== "number" ||
      !Number.isFinite(portion) ||
      portion < PORTION_STEP ||
      portion > MAX_PORTION ||
      !Number.isInteger(portion / PORTION_STEP)
    ) {
      return {
        ok: false,
        error: "The portion must be in quarters, from ¼ to 10.",
      };
    }
    patch.portion = portion;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Send { status } or { portion }." };
  }
  return { ok: true, patch };
}

export class LogError extends Error {
  name = "LogError";
  constructor(
    message: string,
    readonly status: 404 | 409 = 404,
  ) {
    super(message);
  }
}

// The day's restaurant entries for a slot.
async function eatOuts(
  supabase: Supabase,
  date: string,
  slot: MealSlot,
): Promise<LogEntryRow[]> {
  return (
    check(
      await supabase
        .from("log_entries")
        .select("*")
        .eq("date", date)
        .eq("slot", slot)
        .eq("kind", "restaurant"),
    ) ?? []
  );
}

// US-21, US-22: confirms an entry as eaten, marks it skipped (or back to
// planned), and/or changes the portion eaten. A planned meal that an eat-out
// replaced stays skipped until the eat-out is removed, so both never count.
export async function updateLogEntry(
  supabase: Supabase,
  id: number,
  patch: LogPatch,
): Promise<DayEntry> {
  const row = check(
    await supabase.from("log_entries").select("*").eq("id", id).maybeSingle(),
  );
  if (!row) throw new LogError("Entry not found");
  if (
    row.kind === "planned" &&
    patch.status !== undefined &&
    patch.status !== "skipped" &&
    (await eatOuts(supabase, row.date, row.slot)).length > 0
  ) {
    throw new LogError(
      "You ate out for this meal. Remove the eat-out to bring it back.",
      409,
    );
  }
  check(await supabase.from("log_entries").update(patch).eq("id", id));
  const [entry] = await entryViews(supabase, [{ ...row, ...patch }]);
  return entry;
}

export type RestaurantInput = {
  date: string;
  slot: MealSlot;
  restaurantName: string | null;
  itemName: string;
  // How much of the item was eaten: 1 is all of it.
  amount: number;
  // For the whole item.
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function isMealSlotValue(v: unknown): v is MealSlot {
  return MEAL_SLOTS.includes(v as MealSlot);
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t === "" ? null : t.slice(0, max);
}

const NUTRIENT_LIMITS = {
  kcal: { label: "Calories", max: 5000 },
  proteinG: { label: "Protein", max: 500 },
  carbsG: { label: "Carbs", max: 1000 },
  fatG: { label: "Fat", max: 500 },
} as const;

// POST /api/log/restaurant body (US-24).
export function parseRestaurant(
  body: unknown,
  isDate: (s: string) => boolean,
): { ok: true; input: RestaurantInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Send the restaurant meal." };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.date !== "string" || !isDate(b.date)) {
    return { ok: false, error: "date must be YYYY-MM-DD." };
  }
  if (!isMealSlotValue(b.slot)) {
    return { ok: false, error: "Choose which meal it replaces." };
  }
  const itemName = text(b.itemName, 120);
  if (!itemName) return { ok: false, error: "Enter what you ate." };
  const amount = b.amount ?? 1;
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < PORTION_STEP ||
    amount > MAX_PORTION ||
    !Number.isInteger(amount / PORTION_STEP)
  ) {
    return {
      ok: false,
      error: "The amount eaten must be in quarters, from ¼ to 10.",
    };
  }
  const values = {} as Pick<
    RestaurantInput,
    "kcal" | "proteinG" | "carbsG" | "fatG"
  >;
  for (const [key, { label, max }] of Object.entries(NUTRIENT_LIMITS)) {
    const v = b[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) {
      return { ok: false, error: `${label} must be between 0 and ${max}.` };
    }
    values[key as keyof typeof values] = Math.round(v * 10) / 10;
  }
  return {
    ok: true,
    input: {
      date: b.date,
      slot: b.slot,
      restaurantName: text(b.restaurantName, 80),
      itemName,
      amount,
      ...values,
    },
  };
}

// US-24, US-25: the planned meal for that slot is skipped and the restaurant
// item is added as eaten, so it counts in its place. The rest of the day is
// left as it is. Returns the day.
export async function addRestaurantEntry(
  supabase: Supabase,
  input: RestaurantInput,
): Promise<DayLog> {
  check(
    await supabase
      .from("log_entries")
      .update({ status: "skipped" })
      .eq("date", input.date)
      .eq("slot", input.slot)
      .eq("kind", "planned"),
  );
  check(
    await supabase.from("log_entries").insert({
      date: input.date,
      slot: input.slot,
      kind: "restaurant",
      status: "confirmed",
      portion: input.amount,
      restaurant_name: input.restaurantName,
      item_name: input.itemName,
      kcal: input.kcal,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
    }),
  );
  return loadDay(supabase, input.date);
}

// Removes a restaurant entry. When it was the slot's last one, the planned
// meal goes back to planned. Returns the day.
export async function deleteRestaurantEntry(
  supabase: Supabase,
  id: number,
): Promise<DayLog> {
  const row = check(
    await supabase.from("log_entries").select("*").eq("id", id).maybeSingle(),
  );
  if (!row) throw new LogError("Entry not found");
  if (row.kind !== "restaurant") {
    throw new LogError("Only an eat-out can be removed.", 409);
  }
  check(await supabase.from("log_entries").delete().eq("id", id));
  if ((await eatOuts(supabase, row.date, row.slot)).length === 0) {
    check(
      await supabase
        .from("log_entries")
        .update({ status: "planned" })
        .eq("date", row.date)
        .eq("slot", row.slot)
        .eq("kind", "planned"),
    );
  }
  return loadDay(supabase, row.date);
}
