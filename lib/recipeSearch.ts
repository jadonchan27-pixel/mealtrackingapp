// Recipe search for one meal slot (US-8, architecture "Recipe pipeline"):
// search the web, read and save each recipe page, price the recipes, and
// return the top 3 ranked candidates.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MealSlot, RecipeRow } from "@/lib/db/types";
import { updateRecipeCosts } from "@/lib/cost";
import type { FoodLookup } from "@/lib/foods";
import {
  countIngredients,
  inIngredientRange,
  type IngredientRange,
} from "@/lib/ingredientCount";
import { rankRecipes, type RankedRecipe } from "@/lib/ranking";
import { saveRecipeFromUrl } from "@/lib/recipes";
import { MAX_RESULTS, type BraveClient } from "@/lib/services/braveSearch";
import type { RecipePage } from "@/lib/services/recipePage";

// Protein foods to search for in each slot. "high protein" in the query
// mostly finds roundup articles (1 usable recipe in 20 in the live check),
// while naming a protein finds single recipes (8 in 20); ranking still
// favors protein per calorie. TR-24: each week searches a few of them.
export const SLOT_PROTEINS: Record<MealSlot, readonly string[]> = {
  breakfast: [
    "egg",
    "greek yogurt",
    "cottage cheese",
    "turkey sausage",
    "tofu",
  ],
  lunch: ["chicken", "lentil", "tuna", "turkey", "black bean", "shrimp"],
  dinner: ["chicken", "beef", "pork", "salmon", "shrimp", "tofu", "turkey"],
  snack: ["greek yogurt", "egg", "cottage cheese", "edamame"],
};

// Proteins searched per slot each week.
export const PROTEINS_PER_WEEK = 3;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// TR-24: this week's proteins for a slot. Each week starts 3 further along
// the list (wrapping), so consecutive weeks search different proteins.
export function weekProteins(slot: MealSlot, weekStart?: string): string[] {
  const list = SLOT_PROTEINS[slot];
  const week = weekStart
    ? Math.round(Date.parse(`${weekStart}T00:00:00Z`) / WEEK_MS)
    : 0;
  const start =
    (((week * PROTEINS_PER_WEEK) % list.length) + list.length) % list.length;
  return Array.from(
    { length: Math.min(PROTEINS_PER_WEEK, list.length) },
    (_, i) => list[(start + i) % list.length],
  );
}

// e.g. "Indian chicken dinner recipe"
export function searchQuery(
  slot: MealSlot,
  cuisine?: string,
  protein?: string,
): string {
  return [cuisine?.trim(), protein, slot, "recipe"].filter(Boolean).join(" ");
}

// One search per cuisine (or one with none) and protein of the week.
export function searchQueries(
  slot: MealSlot,
  cuisines: readonly string[] = [],
  weekStart?: string,
): string[] {
  const chosen = cuisines.length > 0 ? cuisines : [undefined];
  const proteins = weekProteins(slot, weekStart);
  return chosen.flatMap((c) => proteins.map((p) => searchQuery(slot, c, p)));
}

// Brave result pages fetched per search (TR-24).
export const SEARCH_PAGES = 2;

// Pages read per slot: a slot runs in one request (architecture), so this
// bounds how long it takes.
export const MAX_PAGES = 2 * MAX_RESULTS;
// Pages read at the same time.
const PAGE_CONCURRENCY = 4;

// Sites whose pages are videos or posts, never a recipe page to read.
const NON_RECIPE_HOSTS = [
  "youtube.com",
  "youtu.be",
  "pinterest.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "x.com",
  "twitter.com",
];

// Skips links that can't be a single recipe: video and social sites, and
// category, tag and search listing pages.
export function mightBeRecipePage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  if (NON_RECIPE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return false;
  }
  if (/\.pdf$/i.test(u.pathname)) return false;
  return !/\/(category|categories|tag|tags|search|collections?)\//i.test(
    `${u.pathname}/`,
  );
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

export const SEARCH_PAUSE_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Runs `fn` over the items, at most `limit` at a time, keeping their order.
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type SlotSearchResult = {
  top: RankedRecipe<RecipeRow>[];
  // Recipes read for this search (saved now or already stored).
  recipes: RecipeRow[];
  skipped: SkippedPage[];
};

// Searches for each chosen cuisine and slot protein, then reads up to 20 of
// the results, a few at a time. A search that fails, or a page that can't be
// read or has no usable recipe, is skipped, not fatal.
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
  wait = sleep,
  ingredientRange,
  weekStart,
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
  wait?: (ms: number) => Promise<void>;
  // US-28: how many ingredients a dish may need (pantry staples left out).
  ingredientRange?: IngredientRange;
  // TR-24: picks the week's proteins.
  weekStart?: string;
}): Promise<SlotSearchResult> {
  const lists: string[][] = [];
  const skipped: SkippedPage[] = [];
  let searchError: unknown = null;
  let searches = 0;
  for (const q of searchQueries(slot, cuisines, weekStart)) {
    const list: string[] = [];
    for (let page = 0; page < SEARCH_PAGES; page++) {
      // Brave's free plan allows about one request per second.
      if (searches++ > 0) await wait(SEARCH_PAUSE_MS);
      try {
        const found = await brave.search(q, MAX_RESULTS, page);
        list.push(...found.filter((u) => mightBeRecipePage(u)));
        // An empty page means there are no more results.
        if (found.length === 0) break;
      } catch (err) {
        // One failed search shouldn't lose the other searches' results.
        searchError = err;
        skipped.push({ url: `search: ${q}`, reason: errorMessage(err) });
        break;
      }
    }
    if (list.length > 0) lists.push(list);
  }
  // Take the searches' results in turn, so each gets its best links in.
  const urls: string[] = [];
  for (let rank = 0; urls.length < MAX_PAGES; rank++) {
    const next = lists.map((l) => l[rank]).filter((u) => u !== undefined);
    if (next.length === 0) break;
    for (const url of next) {
      if (!urls.includes(url) && urls.length < MAX_PAGES) urls.push(url);
    }
  }
  if (urls.length === 0 && searchError !== null) throw searchError;

  const outcomes = await mapWithConcurrency(urls, PAGE_CONCURRENCY, (url) =>
    saveRecipeFromUrl({ supabase, url, lookup, readPage, userId }),
  );
  const recipes: RecipeRow[] = [];
  outcomes.forEach((outcome, i) => {
    const url = urls[i];
    if (outcome.status === "rejected") {
      skipped.push({ url, reason: errorMessage(outcome.reason) });
      return;
    }
    const result = outcome.value;
    if (result.status === "skipped") {
      skipped.push({ url, reason: result.reason });
    } else if (!recipes.some((r) => r.id === result.recipe.id)) {
      recipes.push(result.recipe);
    }
  });

  // TR-22: recipes needing more or fewer ingredients than the range are
  // left out, like the ones from last week.
  const excluded = new Set(excludedIds);
  if (
    ingredientRange &&
    (ingredientRange.min !== null || ingredientRange.max !== null) &&
    recipes.length > 0
  ) {
    const lines = await supabase
      .from("recipe_ingredients")
      .select("recipe_id, raw_text")
      .in(
        "recipe_id",
        recipes.map((r) => r.id),
      );
    if (lines.error) throw new Error(lines.error.message);
    for (const r of recipes) {
      const count = countIngredients(
        (lines.data ?? [])
          .filter((l) => l.recipe_id === r.id)
          .map((l) => l.raw_text),
      );
      if (!inIngredientRange(count, ingredientRange)) excluded.add(r.id);
    }
  }

  const costs = await updateRecipeCosts(supabase, recipes);
  const priced = recipes.map((r) => ({
    ...r,
    cost_cents_per_serving: costs.get(r.id) ?? null,
  }));
  return {
    top: rankRecipes(priced, { cuisines, excludedIds: excluded, limit }),
    recipes: priced,
    skipped,
  };
}
