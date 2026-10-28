// Batch cooking (US-12, TR-14): the week's food is cooked twice, on Sunday
// for Sunday to Wednesday and on Thursday for Thursday to Saturday. Each
// batch makes servings per day × days of every recipe.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MealSlot } from "@/lib/db/types";
import { parseIngredient } from "@/lib/ingredients/parse";
import { loadRecipe, PlanError, weekDates, type WeekView } from "@/lib/plans";
import { MEAL_SLOTS } from "@/lib/weeks";

export const BATCHES = [
  { batch: "sunday", label: "Sunday batch", days: 4, firstDay: 0 },
  { batch: "thursday", label: "Thursday batch", days: 3, firstDay: 4 },
] as const;

export type BatchName = (typeof BATCHES)[number]["batch"];

export type BatchIngredient = {
  // The recipe's line with its amount scaled, e.g. "2¼ cups rice".
  text: string;
  // Grams for the batch, when the line's weight is known.
  grams: number | null;
};

export type BatchRecipe = {
  slot: MealSlot;
  recipeId: number;
  title: string;
  photoUrl: string | null;
  servingsPerDay: number;
  // Servings the batch makes: servings per day × days.
  servings: number;
  // Batch servings ÷ the recipe's own servings.
  factor: number;
  ingredients: BatchIngredient[];
  steps: string[];
};

export type Batch = {
  batch: BatchName;
  label: string;
  days: number;
  // First and last day it covers, YYYY-MM-DD.
  from: string;
  to: string;
  recipes: BatchRecipe[];
};

const GLYPHS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

// Kitchen amounts: quarters under 10 ("2¼"), whole numbers above.
export function formatAmount(n: number): string {
  if (n >= 10) return String(Math.round(n));
  const q = Math.round(n * 4) / 4;
  if (q === 0) return String(Math.round(n * 100) / 100);
  const whole = Math.floor(q);
  const part = GLYPHS[q - whole] ?? "";
  return whole === 0 ? part : `${whole}${part}`;
}

const ABBREVIATED = new Set([
  "tsp",
  "tbsp",
  "oz",
  "fl_oz",
  "lb",
  "g",
  "kg",
  "ml",
  "l",
]);

function unitLabel(unit: string, amount: number): string {
  if (unit === "fl_oz") return "fl oz";
  if (ABBREVIATED.has(unit) || amount <= 1) return unit;
  return unit.endsWith("s") || unit.endsWith("x") ? `${unit}es` : `${unit}s`;
}

// The recipe's ingredient line with its amount multiplied by `factor`.
// Lines without an amount ("salt to taste") stay as written.
export function scaleLine(raw: string, factor: number): string {
  const parsed = parseIngredient(raw);
  if (parsed.status !== "parsed" || parsed.quantity === null) return raw.trim();
  const amount = parsed.quantity * factor;
  const max = parsed.quantityMax === null ? null : parsed.quantityMax * factor;
  const parts = [
    max === null
      ? formatAmount(amount)
      : `${formatAmount(amount)}–${formatAmount(max)}`,
  ];
  if (parsed.unit !== null) parts.push(unitLabel(parsed.unit, max ?? amount));
  if (parsed.size?.unit != null) {
    parts.push(
      `(${formatAmount(parsed.size.quantity)} ${unitLabel(parsed.size.unit, parsed.size.quantity)})`,
    );
  }
  parts.push(parsed.food);
  const text = parts.join(" ");
  return parsed.note ? `${text}, ${parsed.note}` : text;
}

type RecipeForBatch = {
  id: number;
  title: string;
  photoUrl: string | null;
  servings: number;
  ingredients: { text: string; grams: number | null }[];
  steps: string[];
};

// One batch's recipes, each scaled to servings per day × days.
export function buildBatch(
  batch: (typeof BATCHES)[number],
  weekStart: string,
  items: readonly {
    slot: MealSlot;
    servingsPerDay: number;
    recipe: RecipeForBatch;
  }[],
): Batch {
  const dates = weekDates(weekStart);
  return {
    batch: batch.batch,
    label: batch.label,
    days: batch.days,
    from: dates[batch.firstDay],
    to: dates[batch.firstDay + batch.days - 1],
    recipes: items.map(({ slot, servingsPerDay, recipe }) => {
      const servings = servingsPerDay * batch.days;
      const factor = servings / recipe.servings;
      return {
        slot,
        recipeId: recipe.id,
        title: recipe.title,
        photoUrl: recipe.photoUrl,
        servingsPerDay,
        servings,
        factor,
        ingredients: recipe.ingredients.map((line) => ({
          text: scaleLine(line.text, factor),
          grams: line.grams === null ? null : Math.round(line.grams * factor),
        })),
        steps: recipe.steps,
      };
    }),
  };
}

// Both batches for a finalized week, recipes in slot order.
export async function batchesForWeek(
  supabase: SupabaseClient<Database>,
  week: Pick<WeekView, "status" | "weekStart" | "items">,
): Promise<Batch[]> {
  if (week.status !== "final") {
    throw new PlanError("Finalize the week first", 409);
  }
  const items: Parameters<typeof buildBatch>[2][number][] = [];
  for (const slot of MEAL_SLOTS) {
    for (const item of week.items.filter((i) => i.slot === slot)) {
      const recipe = await loadRecipe(supabase, item.recipe.id);
      if (!recipe) throw new PlanError(`The ${slot} recipe is missing`, 409);
      items.push({ slot, servingsPerDay: item.servingsPerDay, recipe });
    }
  }
  return BATCHES.map((b) => buildBatch(b, week.weekStart, items));
}
