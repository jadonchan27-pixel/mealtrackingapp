// Recipe nutrition (TR-8): convert each parsed ingredient to grams using its
// food's portion weights, then sum USDA's per-100 g values and divide by servings.

import type { FoodRow, Json } from "@/lib/db/types";
import type { FoodLookup } from "@/lib/foods";
import {
  parseIngredient,
  type IngredientResult,
  type Measure,
  type ParsedIngredient,
} from "@/lib/ingredients/parse";
import { isMassUnit, isVolumeUnit, toGrams, toMl } from "@/lib/units";

export type FoodNutrition = Pick<
  FoodRow,
  | "kcal_100g"
  | "protein_100g"
  | "carbs_100g"
  | "fat_100g"
  | "fiber_100g"
  | "sugar_100g"
  | "sodium_mg_100g"
  | "grams_per_unit"
>;

export type Nutrients = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type MissingIngredient = {
  raw: string;
  reason: "unparsed" | "no food match" | "unknown weight";
};

export type RecipeNutrition = {
  perServing: Nutrients;
  total: Nutrients;
  // Lines left out of the totals, so the UI can say the numbers are incomplete.
  missing: MissingIngredient[];
};

// Size words for whole items, tried in this order when a line has no unit.
const WHOLE_ITEM_KEYS = [
  "each",
  "medium",
  "large",
  "small",
  "extra large",
  "jumbo",
];

function gramsPerUnit(
  food: Pick<FoodNutrition, "grams_per_unit">,
): Record<string, number> {
  const json: Json = food.grams_per_unit;
  if (typeof json !== "object" || json === null || Array.isArray(json))
    return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(json)) {
    if (typeof v === "number" && v > 0) out[k] = v;
  }
  return out;
}

// Grams in one of `unit`, or null when the food has no weight for it.
function gramsInOne(
  unit: string | null,
  weights: Record<string, number>,
  foodText: string,
): number | null {
  if (unit !== null && isMassUnit(unit)) return toGrams(1, unit);
  if (unit !== null && isVolumeUnit(unit)) {
    if (weights[unit] !== undefined) return weights[unit];
    // Density from any volume portion: grams per ml × ml in one unit.
    const known = Object.keys(weights).find(isVolumeUnit);
    return known ? (weights[known] / toMl(1, known)) * toMl(1, unit) : null;
  }
  if (unit !== null) return weights[unit] ?? null;

  // No unit ("2 large eggs"): use the size word in the line, then a default size.
  const text = foodText.toLowerCase();
  const named = WHOLE_ITEM_KEYS.find(
    (k) => k !== "each" && new RegExp(`\\b${k}\\b`).test(text),
  );
  if (named && weights[named] !== undefined) return weights[named];
  const fallback = WHOLE_ITEM_KEYS.find((k) => weights[k] !== undefined);
  return fallback ? weights[fallback] : null;
}

// The amount used for a range ("3-4 thighs") is its midpoint.
export function ingredientAmount(ingredient: ParsedIngredient): number | null {
  if (ingredient.quantity === null) return null;
  return ingredient.quantityMax === null
    ? ingredient.quantity
    : (ingredient.quantity + ingredient.quantityMax) / 2;
}

// Grams for one parsed ingredient, 0 for unmeasured lines ("salt to taste"), or
// null when the weight can't be worked out.
export function ingredientGrams(
  ingredient: ParsedIngredient,
  food: Pick<FoodNutrition, "grams_per_unit">,
): number | null {
  const amount = ingredientAmount(ingredient);
  if (amount === null) return 0;
  const weights = gramsPerUnit(food);

  // A package with a stated size: "1 (14.5 oz) can" weighs 14.5 oz.
  const size: Measure | null = ingredient.size;
  if (size && size.unit !== null) {
    const perSize = gramsInOne(size.unit, weights, ingredient.food);
    if (perSize !== null) return amount * size.quantity * perSize;
  }

  const perUnit = gramsInOne(ingredient.unit, weights, ingredient.food);
  return perUnit === null ? null : amount * perUnit;
}

const ZERO: Nutrients = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
};

export function nutrientsFor(grams: number, food: FoodNutrition): Nutrients {
  const per = (value: number | null) => (Number(value ?? 0) * grams) / 100;
  return {
    kcal: per(food.kcal_100g),
    proteinG: per(food.protein_100g),
    carbsG: per(food.carbs_100g),
    fatG: per(food.fat_100g),
    fiberG: per(food.fiber_100g),
    sugarG: per(food.sugar_100g),
    sodiumMg: per(food.sodium_mg_100g),
  };
}

function add(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
    fiberG: a.fiberG + b.fiberG,
    sugarG: a.sugarG + b.sugarG,
    sodiumMg: a.sodiumMg + b.sodiumMg,
  };
}

// Whole kcal and mg, grams to one decimal.
export function roundNutrients(n: Nutrients): Nutrients {
  const g = (v: number) => Math.round(v * 10) / 10;
  return {
    kcal: Math.round(n.kcal),
    proteinG: g(n.proteinG),
    carbsG: g(n.carbsG),
    fatG: g(n.fatG),
    fiberG: g(n.fiberG),
    sugarG: g(n.sugarG),
    sodiumMg: Math.round(n.sodiumMg),
  };
}

export type IngredientWithFood = {
  ingredient: IngredientResult;
  food: FoodNutrition | null;
};

export function recipeNutrition(
  items: readonly IngredientWithFood[],
  servings: number,
): RecipeNutrition {
  if (!(servings > 0)) throw new Error("servings must be more than 0");
  let total = ZERO;
  const missing: MissingIngredient[] = [];

  for (const { ingredient, food } of items) {
    if (ingredient.status === "unparsed") {
      // Headings and blank lines aren't ingredients, so they aren't missing.
      if (ingredient.reason === "no food name")
        missing.push({ raw: ingredient.raw, reason: "unparsed" });
      continue;
    }
    if (ingredient.quantity === null) continue; // "salt to taste"
    if (!food || food.kcal_100g === null) {
      missing.push({ raw: ingredient.raw, reason: "no food match" });
      continue;
    }
    const grams = ingredientGrams(ingredient, food);
    if (grams === null) {
      missing.push({ raw: ingredient.raw, reason: "unknown weight" });
      continue;
    }
    total = add(total, nutrientsFor(grams, food));
  }

  const perServing = Object.fromEntries(
    Object.entries(total).map(([k, v]) => [k, v / servings]),
  ) as Nutrients;
  return {
    perServing: roundNutrients(perServing),
    total: roundNutrients(total),
    missing,
  };
}

// Parses ingredient lines, looks up each food (cache first, then USDA) and
// returns nutrition per serving. Foods are looked up one at a time to stay
// well inside USDA's rate limit.
export async function nutritionForRecipe(
  lines: readonly string[],
  servings: number,
  lookup: FoodLookup,
): Promise<RecipeNutrition & { items: IngredientWithFood[] }> {
  const items: IngredientWithFood[] = [];
  for (const line of lines) {
    const ingredient = parseIngredient(line);
    const food =
      ingredient.status === "parsed" && ingredient.quantity !== null
        ? await lookup(ingredient.food)
        : null;
    items.push({ ingredient, food });
  }
  return { ...recipeNutrition(items, servings), items };
}
