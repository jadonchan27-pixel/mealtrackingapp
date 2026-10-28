// Recipe search for one meal slot (US-8, architecture "Recipe pipeline"):
// search the web, read and save each recipe page, price the recipes, and
// return the top 3 ranked candidates.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MealSlot, RecipeRow } from "@/lib/db/types";
import { updateRecipeCosts } from "@/lib/cost";
import type { FoodLookup } from "@/lib/foods";
import { rankRecipes, type RankedRecipe } from "@/lib/ranking";
import { saveRecipeFromUrl } from "@/lib/recipes";
import { MAX_RESULTS, type BraveClient } from "@/lib/services/braveSearch";
import type { RecipePage } from "@/lib/services/recipePage";

// e.g. "indian high protein dinner recipe"
export function searchQuery(slot: MealSlot, cuisine?: string): string {
  return [cuisine?.trim(), "high protein", slot, "recipe"]
    .filter(Boolean)
    .join(" ");
}

// The Sunday a week before `weekStart` (YYYY-MM-DD).
export function previousWeekStart(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

// TR-13: recipes planned for the week before `weekStart`.
export async function previousWeekRecipeIds(
  supabase: SupabaseClient<Database>,
  weekStart: string,
): Promise<Set<number>> {
  const week = await supabase
    .from("week_plans")
    .select("id")
    .eq("week_start", previousWeekStart(weekStart))
    .maybeSingle();
  if (week.error) throw new Error(week.error.message);
  if (!week.data) return new Set();

  const items = await supabase
    .from("plan_items")
    .select("recipe_id")
    .eq("week_plan_id", week.data.id);
  if (items.error) throw new Error(items.error.message);
  return new Set(items.data.map((i) => i.recipe_id));
}

export type SkippedPage = { url: string; reason: string };

export type SlotSearchResult = {
  top: RankedRecipe<RecipeRow>[];
  // Recipes read for this search (saved now or already stored).
  recipes: RecipeRow[];
  skipped: SkippedPage[];
};

// Searches once per chosen cuisine (or once with none), splitting Brave's 20
// results between them, then reads each page in turn. A page that can't be
// read or has no usable recipe is skipped, not fatal.
export async function findTopRecipes({
  supabase,
  brave,
  lookup,
  slot,
  cuisines = [],
  excludedIds = new Set(),
  limit = 3,
  readPage,
  userId,
}: {
  supabase: SupabaseClient<Database>;
  brave: Pick<BraveClient, "search">;
  lookup: FoodLookup;
  slot: MealSlot;
  cuisines?: readonly string[];
  // Recipes used last week (see previousWeekRecipeIds).
  excludedIds?: ReadonlySet<number>;
  limit?: number;
  readPage?: (url: string) => Promise<RecipePage | null>;
  userId?: string;
}): Promise<SlotSearchResult> {
  const queries =
    cuisines.length > 0
      ? cuisines.map((c) => searchQuery(slot, c))
      : [searchQuery(slot)];
  const perQuery = Math.max(1, Math.floor(MAX_RESULTS / queries.length));

  const urls: string[] = [];
  for (const q of queries) {
    for (const url of await brave.search(q, perQuery)) {
      if (!urls.includes(url)) urls.push(url);
    }
  }

  const recipes: RecipeRow[] = [];
  const skipped: SkippedPage[] = [];
  for (const url of urls) {
    try {
      const result = await saveRecipeFromUrl({
        supabase,
        url,
        lookup,
        readPage,
        userId,
      });
      if (result.status === "skipped") {
        skipped.push({ url, reason: result.reason });
      } else if (!recipes.some((r) => r.id === result.recipe.id)) {
        recipes.push(result.recipe);
      }
    } catch (err) {
      skipped.push({
        url,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const costs = await updateRecipeCosts(supabase, recipes);
  const priced = recipes.map((r) => ({
    ...r,
    cost_cents_per_serving: costs.get(r.id) ?? null,
  }));
  return {
    top: rankRecipes(priced, { cuisines, excludedIds, limit }),
    recipes: priced,
    skipped,
  };
}
