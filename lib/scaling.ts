// Portion scaling (TR-12, US-11): how many servings of each picked recipe to
// eat per day so the day lands near the calorie and protein targets.
// The meals share the calories evenly, a dish eaten for two meals (US-33's
// lunch-and-dinner dish) counting twice; in older weeks with a snack, the
// meals share ~80% and the snack takes ~20% as 1 or 2 servings. Servings are
// in quarters per meal.

import type { MealSlot } from "@/lib/db/types";

export type ScalableRecipe = {
  slot: MealSlot;
  recipeId: number;
  // Per serving.
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  // US-33: meals a day this recipe covers (2 for the lunch-and-dinner dish).
  meals?: number;
};

export type ScaledItem = ScalableRecipe & { servingsPerDay: number };

export type DailyTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const MEAL_SHARE = 0.8;
export const SERVING_STEP = 0.25;
// Protein top-up: at most this many extra servings, keeping the day within
// this share of the calorie target.
export const MAX_PROTEIN_TOP_UP = 0.5;
export const KCAL_TOLERANCE = 0.05;

const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];

function quarters(servings: number): number {
  return Math.round(servings / SERVING_STEP) * SERVING_STEP;
}

export function dailyTotals(
  items: readonly (ScalableRecipe & { servingsPerDay: number })[],
): DailyTotals {
  const sum = (key: keyof DailyTotals) =>
    items.reduce((t, i) => t + i[key] * i.servingsPerDay, 0);
  return {
    kcal: sum("kcal"),
    proteinG: sum("proteinG"),
    carbsG: sum("carbsG"),
    fatG: sum("fatG"),
  };
}

// Servings per day for each picked recipe (one per slot). The snack is
// 1 or 2 servings, whichever is nearer its 20%; the meals split what's left
// evenly, each rounded to a quarter serving in whichever direction keeps the
// day closest to the target. If protein is short, the recipe with the most
// protein per serving gets up to half a serving more while the day stays
// within 5% of the calorie target.
export function scalePortions(
  recipes: readonly ScalableRecipe[],
  targets: { kcal: number; proteinG: number },
): ScaledItem[] {
  for (const r of recipes) {
    if (!(r.kcal > 0)) throw new Error(`Recipe ${r.recipeId} has no calories`);
  }
  const meals = recipes.filter((r) => MEAL_SLOTS.includes(r.slot));
  const snacks = recipes.filter((r) => !MEAL_SLOTS.includes(r.slot));

  const mealCount = meals.reduce((n, r) => n + (r.meals ?? 1), 0);
  const snackShare =
    meals.length === 0 ? 1 : snacks.length === 0 ? 0 : 1 - MEAL_SHARE;
  const perSnack = (targets.kcal * snackShare) / Math.max(snacks.length, 1);
  const scaledSnacks = snacks.map((r) => ({
    ...r,
    servingsPerDay: Math.min(2, Math.max(1, Math.round(perSnack / r.kcal))),
  }));
  const snackKcal = dailyTotals(scaledSnacks).kcal;

  // Each meal's exact share, then the quarter below or above it.
  const perMeal =
    Math.max(0, targets.kcal - snackKcal) / Math.max(mealCount, 1);
  const options = meals.map((r) => {
    const exact = perMeal / r.kcal;
    const down = Math.max(
      SERVING_STEP,
      Math.floor(exact / SERVING_STEP) * SERVING_STEP,
    );
    const up = Math.max(
      SERVING_STEP,
      Math.ceil(exact / SERVING_STEP) * SERVING_STEP,
    );
    return down === up ? [down] : [down, up];
  });
  let best: number[] = [];
  let bestError = Infinity;
  const choose = (i: number, picked: number[], kcal: number) => {
    if (i === meals.length) {
      const error = Math.abs(kcal + snackKcal - targets.kcal);
      if (error < bestError - 1e-9) {
        bestError = error;
        best = picked;
      }
      return;
    }
    for (const s of options[i])
      choose(
        i + 1,
        [...picked, s],
        kcal + s * meals[i].kcal * (meals[i].meals ?? 1),
      );
  };
  choose(0, [], 0);
  // Servings per day cover every meal the recipe is eaten at.
  const scaledMeals = meals.map((r, i) => ({
    ...r,
    servingsPerDay: quarters(best[i]) * (r.meals ?? 1),
  }));

  const items = [...scaledMeals, ...scaledSnacks];
  const maxKcal = targets.kcal * (1 + KCAL_TOLERANCE);
  const proteinPick = [...scaledMeals].sort(
    (a, b) => b.proteinG - a.proteinG,
  )[0];
  if (proteinPick) {
    // A dish eaten at two meals grows a quarter at each, half a serving a
    // day, so its day still gains at most MAX_PROTEIN_TOP_UP.
    const step = SERVING_STEP * (proteinPick.meals ?? 1);
    for (let extra = step; extra <= MAX_PROTEIN_TOP_UP + 1e-9; extra += step) {
      const totals = dailyTotals(items);
      if (totals.proteinG >= targets.proteinG) break;
      if (totals.kcal + proteinPick.kcal * step > maxKcal) break;
      proteinPick.servingsPerDay += step;
    }
  }

  // Back in slot order.
  return recipes.map((r) =>
    items.find((i) => i.slot === r.slot && i.recipeId === r.recipeId)!,
  );
}
