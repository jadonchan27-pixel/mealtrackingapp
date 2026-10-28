// Cost per serving (US-13, TR-11): each ingredient's share of its H-E-B
// product's price, by weight, summed and divided by servings. Prices are
// estimates until the price table is built (step 15).

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  HebProductRow,
  RecipeIngredientRow,
} from "@/lib/db/types";

type Product = Pick<HebProductRow, "food_id" | "package_grams" | "price_cents">;

// The cheapest price per gram for each food.
export function centsPerGramByFood(
  products: readonly Product[],
): Map<number, number> {
  const best = new Map<number, number>();
  for (const p of products) {
    if (!(p.package_grams > 0) || p.price_cents < 0) continue;
    const perGram = p.price_cents / p.package_grams;
    const current = best.get(p.food_id);
    if (current === undefined || perGram < current)
      best.set(p.food_id, perGram);
  }
  return best;
}

// Whole cents per serving, or null when any weighed ingredient has no price
// (a partial sum would make that recipe look cheaper than it is).
export function costPerServing(
  ingredients: readonly Pick<RecipeIngredientRow, "food_id" | "grams">[],
  centsPerGram: ReadonlyMap<number, number>,
  servings: number,
): number | null {
  if (!(servings > 0)) return null;
  let total = 0;
  let priced = 0;
  for (const { food_id, grams } of ingredients) {
    if (food_id === null || grams === null || grams <= 0) continue;
    const perGram = centsPerGram.get(food_id);
    if (perGram === undefined) return null;
    total += grams * perGram;
    priced++;
  }
  return priced === 0 ? null : Math.round(total / servings);
}

// Works out cost per serving for the given recipes and stores it on each
// recipe row. Returns the costs by recipe id.
export async function updateRecipeCosts(
  supabase: SupabaseClient<Database>,
  recipes: readonly { id: number; servings: number }[],
): Promise<Map<number, number | null>> {
  const costs = new Map<number, number | null>();
  if (recipes.length === 0) return costs;

  const ingredients = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, food_id, grams")
    .in(
      "recipe_id",
      recipes.map((r) => r.id),
    );
  if (ingredients.error) throw new Error(ingredients.error.message);

  const foodIds = [
    ...new Set(
      ingredients.data
        .map((i) => i.food_id)
        .filter((id): id is number => id !== null),
    ),
  ];
  const products =
    foodIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("heb_products")
          .select("food_id, package_grams, price_cents")
          .in("food_id", foodIds);
  if (products.error) throw new Error(products.error.message);
  const centsPerGram = centsPerGramByFood(products.data);

  for (const recipe of recipes) {
    const cost = costPerServing(
      ingredients.data.filter((i) => i.recipe_id === recipe.id),
      centsPerGram,
      recipe.servings,
    );
    costs.set(recipe.id, cost);
    const updated = await supabase
      .from("recipes")
      .update({ cost_cents_per_serving: cost })
      .eq("id", recipe.id);
    if (updated.error) throw new Error(updated.error.message);
  }
  return costs;
}
