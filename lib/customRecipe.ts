// Own recipes (US-35, TR-29): Jadon enters a recipe's nutrition himself; it
// is saved like a web recipe and becomes the slot's pick.

import type { SupabaseClient } from "@supabase/supabase-js";
import { updateRecipeCosts } from "@/lib/cost";
import type { Database, MealSlot } from "@/lib/db/types";
import type { FoodLookup } from "@/lib/foods";
import { nutritionForRecipe } from "@/lib/nutrition";
import { PlanError, loadWeekById, type WeekView } from "@/lib/plans";
import { saveIngredients } from "@/lib/recipes";
import { isMealSlot, PLAN_SLOTS } from "@/lib/weeks";

export const CUSTOM_LIMITS = {
  servings: { min: 1, max: 50 },
  kcal: { min: 1, max: 5000 },
  grams: { min: 0, max: 500 },
  activeMinutes: { min: 0, max: 600 },
  // Dollars per serving.
  cost: { min: 0, max: 100 },
  lines: 60,
  title: 120,
} as const;

export type CustomRecipeInput = {
  slot: MealSlot;
  title: string;
  servings: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  steps: string[];
  sourceUrl: string | null;
  activeMinutes: number | null;
  costCentsPerServing: number | null;
};

export type CustomRecipeParse =
  | { ok: true; value: CustomRecipeInput }
  | { ok: false; errors: Partial<Record<keyof CustomRecipeInput, string>> };

const CUSTOM_PREFIX = "custom:";

// A recipe Jadon entered himself has no page of its own to link to.
export function isCustomSource(sourceUrl: string): boolean {
  return sourceUrl.startsWith(CUSTOM_PREFIX);
}

function numberIn(
  value: unknown,
  { min, max }: { min: number; max: number },
): number | null {
  const n =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max
    ? n
    : null;
}

function blank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

// Lines from a list or from text with one per line, blanks dropped.
function lines(value: unknown): string[] | null {
  if (blank(value)) return [];
  const list =
    typeof value === "string"
      ? value.split("\n")
      : Array.isArray(value) && value.every((v) => typeof v === "string")
        ? value
        : null;
  if (!list) return null;
  return list.map((l) => l.trim()).filter((l) => l !== "");
}

export function parseCustomRecipe(body: unknown): CustomRecipeParse {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: Partial<Record<keyof CustomRecipeInput, string>> = {};
  const L = CUSTOM_LIMITS;

  if (!isMealSlot(b.slot) || !PLAN_SLOTS.includes(b.slot)) {
    errors.slot = "Choose breakfast or lunch & dinner.";
  }
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (title === "" || title.length > L.title) {
    errors.title = `Give it a name of up to ${L.title} characters.`;
  }
  const servings = numberIn(b.servings, L.servings);
  if (servings === null) {
    errors.servings = `Servings must be from ${L.servings.min} to ${L.servings.max}.`;
  }
  const kcal = numberIn(b.kcal, L.kcal);
  if (kcal === null) {
    errors.kcal = `Calories per serving must be from ${L.kcal.min} to ${L.kcal.max}.`;
  }
  const grams = (key: "proteinG" | "carbsG" | "fatG", name: string) => {
    const v = numberIn(b[key], L.grams);
    if (v === null) {
      errors[key] =
        `${name} per serving must be from ${L.grams.min} to ${L.grams.max} g.`;
    }
    return v;
  };
  const proteinG = grams("proteinG", "Protein");
  const carbsG = grams("carbsG", "Carbs");
  const fatG = grams("fatG", "Fat");

  const ingredients = lines(b.ingredients);
  if (ingredients === null || ingredients.length > L.lines) {
    errors.ingredients = `List up to ${L.lines} ingredients, one per line.`;
  }
  const steps = lines(b.steps);
  if (steps === null || steps.length > L.lines) {
    errors.steps = `List up to ${L.lines} steps, one per line.`;
  }

  let sourceUrl: string | null = null;
  if (!blank(b.sourceUrl)) {
    try {
      const url = new URL(String(b.sourceUrl).trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw 0;
      sourceUrl = url.toString();
    } catch {
      errors.sourceUrl = "The link must start with http:// or https://.";
    }
  }
  let activeMinutes: number | null = null;
  if (!blank(b.activeMinutes)) {
    const v = numberIn(b.activeMinutes, L.activeMinutes);
    if (v === null || !Number.isInteger(v)) {
      errors.activeMinutes = `Cook time must be whole minutes from ${L.activeMinutes.min} to ${L.activeMinutes.max}.`;
    } else activeMinutes = v;
  }
  let costCentsPerServing: number | null = null;
  if (!blank(b.costPerServing)) {
    const v = numberIn(b.costPerServing, L.cost);
    if (v === null) {
      errors.costCentsPerServing = `Cost per serving must be from $${L.cost.min} to $${L.cost.max}.`;
    } else costCentsPerServing = Math.round(v * 100);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      slot: b.slot as MealSlot,
      title,
      servings: servings!,
      kcal: kcal!,
      proteinG: proteinG!,
      carbsG: carbsG!,
      fatG: fatG!,
      ingredients: ingredients!,
      steps: steps!,
      sourceUrl,
      activeMinutes,
      costCentsPerServing,
    },
  };
}

// Saves the recipe and makes it the slot's pick, first in rank. Its
// ingredients are matched to foods for the shopping list, but the
// nutrition stays as entered.
export async function addCustomRecipe(
  supabase: SupabaseClient<Database>,
  weekId: number,
  input: CustomRecipeInput,
  lookup: FoodLookup,
  newId: () => string = () => crypto.randomUUID(),
): Promise<WeekView> {
  const week = await loadWeekById(supabase, weekId);
  if (week.status !== "draft") {
    throw new PlanError("This week's plan is already finalized", 409);
  }

  // A link already saved as a web recipe keeps that recipe; this one is
  // stored under its own key.
  let sourceUrl = input.sourceUrl ?? `${CUSTOM_PREFIX}${newId()}`;
  if (input.sourceUrl) {
    const taken = await supabase
      .from("recipes")
      .select("id")
      .eq("source_url", input.sourceUrl)
      .maybeSingle();
    if (taken.error) throw new PlanError(taken.error.message);
    if (taken.data) sourceUrl = `${CUSTOM_PREFIX}${newId()}`;
  }

  const { items } = await nutritionForRecipe(
    input.ingredients,
    input.servings,
    lookup,
  );
  const saved = await supabase
    .from("recipes")
    .insert({
      source_url: sourceUrl,
      title: input.title,
      servings: input.servings,
      active_minutes: input.activeMinutes,
      steps: input.steps,
      kcal: input.kcal,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
      cost_cents_per_serving: input.costCentsPerServing,
    })
    .select("*")
    .single();
  if (saved.error) throw new PlanError(saved.error.message);
  const recipe = saved.data;
  await saveIngredients(supabase, recipe.id, items);
  if (input.costCentsPerServing === null) {
    await updateRecipeCosts(supabase, [
      { id: recipe.id, servings: input.servings },
    ]);
  }

  const unpick = await supabase
    .from("plan_candidates")
    .update({ selected: false })
    .eq("week_plan_id", week.id)
    .eq("slot", input.slot);
  if (unpick.error) throw new PlanError(unpick.error.message);
  const added = await supabase.from("plan_candidates").insert({
    week_plan_id: week.id,
    slot: input.slot,
    recipe_id: recipe.id,
    rank: 0,
    selected: true,
  });
  if (added.error) throw new PlanError(added.error.message);
  return loadWeekById(supabase, week.id);
}
