// Price limits (US-31, US-32, TR-25, TR-26). A meal's cost is for the
// portion it'll be eaten at, so it uses the same calorie split as portion
// scaling (TR-12) before the week is finalized.

import type { MealSlot } from "@/lib/db/types";
import { MEAL_SHARE, SERVING_STEP } from "@/lib/scaling";
import type { ShoppingList } from "@/lib/shopping";

const MEALS_PER_DAY = 3;

// 1234 → "$12.34"
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Servings a recipe would be eaten at in a slot: the meals share 80% of the
// day's calories evenly; the snack is 1 or 2 servings, whichever is nearer
// its 20%. Unknown calories count as 1 serving.
export function mealServings(
  slot: MealSlot,
  kcalPerServing: number | null,
  dailyKcal: number,
): number {
  if (!kcalPerServing || kcalPerServing <= 0) return 1;
  if (slot === "snack") {
    const share = (dailyKcal * (1 - MEAL_SHARE)) / kcalPerServing;
    return Math.abs(share - 1) <= Math.abs(share - 2) ? 1 : 2;
  }
  const servings = (dailyKcal * MEAL_SHARE) / MEALS_PER_DAY / kcalPerServing;
  return Math.max(
    SERVING_STEP,
    Math.round(servings / SERVING_STEP) * SERVING_STEP,
  );
}

export type CostedRecipe = {
  kcal: number | null;
  cost_cents_per_serving: number | null;
};

// The meal's cost in cents at its portion, or null when the recipe has no
// cost yet.
export function mealCostCents(
  recipe: CostedRecipe,
  slot: MealSlot,
  dailyKcal: number,
): number | null {
  const cost = recipe.cost_cents_per_serving;
  if (cost === null) return null;
  return Math.round(cost * mealServings(slot, recipe.kcal, dailyKcal));
}

export type CostCap = { cents: number; dailyKcal: number };

// TR-25: ranked recipes (best first) within the cap keep their order, and
// unpriced ones count as within it, up to `limit`; if fewer than `fill` fit,
// the cheapest over-cap meals fill up to `fill` places.
export function applyCostCap<T extends { recipe: CostedRecipe }>(
  ranked: readonly T[],
  slot: MealSlot,
  cap: CostCap,
  limit: number,
  fill: number = limit,
): T[] {
  const cost = (r: T) => mealCostCents(r.recipe, slot, cap.dailyKcal);
  const fits = ranked.filter((r) => {
    const c = cost(r);
    return c === null || c <= cap.cents;
  });
  const over = ranked
    .filter((r) => !fits.includes(r))
    .sort((a, b) => cost(a)! - cost(b)!);
  const filler = over.slice(
    0,
    Math.max(0, Math.min(fill, limit) - fits.length),
  );
  return [...fits.slice(0, limit), ...filler];
}

// The tag a candidate shows under a cap: "price unknown", "$1.20 over", or
// nothing when it fits.
export function costTag(
  recipe: CostedRecipe,
  slot: MealSlot,
  cap: CostCap,
): string | null {
  const c = mealCostCents(recipe, slot, cap.dailyKcal);
  if (c === null) return "price unknown";
  if (c <= cap.cents) return null;
  return `$${((c - cap.cents) / 100).toFixed(2)} over`;
}

export type BudgetStatus = {
  totalCents: number;
  budgetCents: number;
  over: boolean;
  // Lines with no store price, only a rough guess by store section, so the
  // total may be off by their cost.
  unpriced: number;
};

// Fallback products are named "<food> (estimated)" (lib/hebCatalog.ts).
export function isUnpriced(item: { name: string; estimate: boolean }) {
  return item.estimate && item.name.endsWith("(estimated)");
}

// TR-26: the week's estimated total against the budget.
export function budgetStatus(
  list: ShoppingList,
  budgetCents: number,
): BudgetStatus {
  const items = list.sections.flatMap((s) => s.items);
  // From the lines, so prices entered since the list loaded count.
  const totalCents = items.reduce((t, i) => t + i.priceCents, 0);
  return {
    totalCents,
    budgetCents,
    over: totalCents > budgetCents,
    unpriced: items.filter(isUnpriced).length,
  };
}
