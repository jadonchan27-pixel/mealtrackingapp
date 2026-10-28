// Candidate ranking (TR-11, TR-13): drop recipes that take over an hour or
// were eaten last week, then score the rest by cuisine match, protein per
// 100 kcal (higher is better) and cost per serving (lower is better).

import type { RecipeRow } from "@/lib/db/types";

export type RankableRecipe = Pick<
  RecipeRow,
  | "id"
  | "title"
  | "cuisine"
  | "active_minutes"
  | "kcal"
  | "protein_g"
  | "cost_cents_per_serving"
>;

export type RankedRecipe<R extends RankableRecipe = RankableRecipe> = {
  recipe: R;
  score: number;
};

// US-13: at most 1 hour of active cooking.
export const MAX_ACTIVE_MINUTES = 60;

// How much each part counts. Every part is scored 0 to 1, so scores run 0 to 1.
export const WEIGHTS = { cuisine: 0.4, protein: 0.35, cost: 0.25 };

// A recipe can be a candidate when its active time is known and within the
// limit, it has nutrition, and it wasn't used last week.
export function isEligible(
  recipe: RankableRecipe,
  excludedIds: ReadonlySet<number> = new Set(),
): boolean {
  return (
    recipe.active_minutes !== null &&
    recipe.active_minutes <= MAX_ACTIVE_MINUTES &&
    recipe.kcal !== null &&
    recipe.kcal > 0 &&
    !excludedIds.has(recipe.id)
  );
}

function cuisineWords(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w !== "");
}

// 1 when the recipe's cuisine is one of the chosen ones, 0 when it's another,
// and 0.5 when the page doesn't say. A chosen cuisine matches when all its
// words are in the recipe's ("Indian" matches "South Indian", but "Asian"
// doesn't match "Caucasian"). With no cuisine chosen, everything fits.
export function cuisineScore(
  recipeCuisine: string | null,
  cuisines: readonly string[],
): number {
  const wanted = cuisines.map(cuisineWords).filter((w) => w.length > 0);
  if (wanted.length === 0) return 1;
  const have = cuisineWords(recipeCuisine ?? "");
  if (have.length === 0) return 0.5;
  return wanted.some((words) => words.every((w) => have.includes(w))) ? 1 : 0;
}

export function proteinPer100Kcal(recipe: RankableRecipe): number {
  if (!recipe.kcal || recipe.kcal <= 0) return 0;
  return ((recipe.protein_g ?? 0) / recipe.kcal) * 100;
}

// 1 for the group's highest value, 0 for its lowest; 1 for all when they tie.
function higherIsBetter(value: number, min: number, max: number): number {
  return max === min ? 1 : (value - min) / (max - min);
}

// 1 for the group's lowest value, 0 for its highest; 1 for all when they tie.
function lowerIsBetter(value: number, min: number, max: number): number {
  return max === min ? 1 : (max - value) / (max - min);
}

// Eligible recipes, best first, with their scores. Protein and cost are
// scored against the other candidates; an unknown cost scores in the middle.
export function rankRecipes<R extends RankableRecipe>(
  recipes: readonly R[],
  {
    cuisines = [],
    excludedIds = new Set(),
    limit = 3,
  }: {
    cuisines?: readonly string[];
    excludedIds?: ReadonlySet<number>;
    limit?: number;
  } = {},
): RankedRecipe<R>[] {
  const pool = recipes.filter((r) => isEligible(r, excludedIds));
  const proteins = pool.map(proteinPer100Kcal);
  const costs = pool
    .map((r) => r.cost_cents_per_serving)
    .filter((c): c is number => c !== null);
  const minProtein = Math.min(...proteins);
  const maxProtein = Math.max(...proteins);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);

  return pool
    .map((recipe, i) => {
      const cost = recipe.cost_cents_per_serving;
      const score =
        WEIGHTS.cuisine * cuisineScore(recipe.cuisine, cuisines) +
        WEIGHTS.protein * higherIsBetter(proteins[i], minProtein, maxProtein) +
        WEIGHTS.cost *
          (cost === null ? 0.5 : lowerIsBetter(cost, minCost, maxCost));
      return { recipe, score: Math.round(score * 1000) / 1000 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
