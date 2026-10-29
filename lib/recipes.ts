// Saving recipes (TR-9): read a recipe page, parse its ingredients, work out
// nutrition per serving, and store the recipe with its ingredients so the
// page is never fetched again.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RecipeIngredientRow, RecipeRow } from "@/lib/db/types";
import type { FoodLookup } from "@/lib/foods";
import {
  ingredientAmount,
  ingredientGrams,
  nutritionForRecipe,
  type MissingIngredient,
} from "@/lib/nutrition";
import { fetchRecipePage, type RecipePage } from "@/lib/services/recipePage";

export type SaveRecipeResult =
  | { status: "saved"; recipe: RecipeRow; missing: MissingIngredient[] }
  | { status: "exists"; recipe: RecipeRow }
  | {
      status: "skipped";
      reason: "no recipe data" | "no servings" | "no nutrition";
    };

export async function saveRecipeFromUrl({
  supabase,
  url,
  lookup,
  readPage = fetchRecipePage,
  userId,
}: {
  supabase: SupabaseClient<Database>;
  url: string;
  lookup: FoodLookup;
  readPage?: (url: string) => Promise<RecipePage | null>;
  // Needed with the admin client, which has no signed-in user to default to.
  userId?: string;
}): Promise<SaveRecipeResult> {
  let query = supabase.from("recipes").select("*").eq("source_url", url);
  if (userId) query = query.eq("user_id", userId);
  const existing = await query.maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return { status: "exists", recipe: existing.data };

  const page = await readPage(url);
  if (!page) return { status: "skipped", reason: "no recipe data" };
  // Nutrition is per serving, so a recipe that doesn't say how many it
  // serves can't be used.
  if (page.servings === null)
    return { status: "skipped", reason: "no servings" };

  const { perServing, items, missing } = await nutritionForRecipe(
    page.ingredients,
    page.servings,
    lookup,
  );
  // A recipe none of whose ingredients could be counted would be saved at
  // 0 kcal, which would look like a perfect fit to the planner.
  const counted = items.filter(
    ({ ingredient }) =>
      (ingredient.status === "parsed" && ingredient.quantity !== null) ||
      (ingredient.status === "unparsed" &&
        ingredient.reason === "no food name"),
  ).length;
  if (counted > 0 && missing.length >= counted) {
    return { status: "skipped", reason: "no nutrition" };
  }
  const owner = userId ? { user_id: userId } : {};

  const saved = await supabase
    .from("recipes")
    .insert({
      ...owner,
      source_url: url,
      title: page.title,
      photo_url: page.photoUrl,
      cuisine: page.cuisine,
      servings: page.servings,
      active_minutes: page.activeMinutes,
      steps: page.steps,
      kcal: perServing.kcal,
      protein_g: perServing.proteinG,
      carbs_g: perServing.carbsG,
      fat_g: perServing.fatG,
      fiber_g: perServing.fiberG,
      sugar_g: perServing.sugarG,
      sodium_mg: perServing.sodiumMg,
    })
    .select("*")
    .single();
  if (saved.error) throw new Error(saved.error.message);
  const recipe = saved.data;
  await saveIngredients(supabase, recipe.id, items, owner);
  return { status: "saved", recipe, missing };
}

type IngredientItems = Awaited<ReturnType<typeof nutritionForRecipe>>["items"];

// Stores a saved recipe's ingredient lines. Every line is kept; lines that
// couldn't be parsed or matched have no food or grams, so they can be shown
// to Jadon. Blank lines and headings ("For the sauce:") aren't ingredients.
// On failure the recipe is deleted too, so none is left without them.
export async function saveIngredients(
  supabase: SupabaseClient<Database>,
  recipeId: number,
  items: IngredientItems,
  owner: { user_id?: string } = {},
): Promise<void> {
  const recipe = { id: recipeId };
  const rows: Omit<
    RecipeIngredientRow,
    "id" | "created_at" | "updated_at" | "user_id"
  >[] = [];
  for (const { ingredient, food } of items) {
    if (ingredient.status === "unparsed") {
      if (ingredient.reason !== "no food name") continue;
      rows.push({
        recipe_id: recipe.id,
        raw_text: ingredient.raw,
        food_id: null,
        quantity: null,
        unit: null,
        grams: null,
      });
      continue;
    }
    const grams = food ? ingredientGrams(ingredient, food) : null;
    rows.push({
      recipe_id: recipe.id,
      raw_text: ingredient.raw,
      food_id: food?.id ?? null,
      quantity: ingredientAmount(ingredient),
      unit: ingredient.unit,
      grams: grams === null ? null : Math.round(grams * 10) / 10,
    });
  }

  if (rows.length > 0) {
    const inserted = await supabase
      .from("recipe_ingredients")
      .insert(rows.map((r) => ({ ...owner, ...r })));
    if (inserted.error) {
      // Don't leave a recipe without its ingredients.
      await supabase.from("recipes").delete().eq("id", recipe.id);
      throw new Error(inserted.error.message);
    }
  }
}
