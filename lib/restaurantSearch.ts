// Eat-out search (US-37, TR-31): items Jadon has logged before, then USDA
// foods, each with calories and macros ready to fill the eat-out form.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { DishResult, UsdaClient } from "@/lib/services/usda";

export const QUERY_LENGTH = { min: 2, max: 100 } as const;
const MAX_PAST = 5;
// Enough past eat-outs to cover months of logging.
const PAST_SCAN = 500;

export type ItemResult = {
  source: "past" | "usda";
  key: string;
  itemName: string;
  restaurantName: string | null;
  // What the numbers are for: "1 item", "1 burrito (219 g)". Past items are
  // the whole item as it was logged.
  portion: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type ItemSearch = { items: ItemResult[]; usdaError: string | null };

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w !== "");

export async function pastItems(
  supabase: SupabaseClient<Database>,
  query: string,
): Promise<ItemResult[]> {
  const res = await supabase
    .from("log_entries")
    .select("id, restaurant_name, item_name, kcal, protein_g, carbs_g, fat_g")
    .eq("kind", "restaurant")
    .order("id", { ascending: false })
    .limit(PAST_SCAN);
  if (res.error) throw new Error(res.error.message);
  const wanted = words(query);
  const seen = new Set<string>();
  const found: ItemResult[] = [];
  for (const row of res.data ?? []) {
    if (row.item_name === null || row.kcal === null) continue;
    const have = words(`${row.restaurant_name ?? ""} ${row.item_name}`);
    if (!wanted.every((w) => have.some((h) => h.startsWith(w)))) continue;
    const name = `${row.restaurant_name ?? ""}|${row.item_name}`.toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    found.push({
      source: "past",
      key: `past:${row.id}`,
      itemName: row.item_name,
      restaurantName: row.restaurant_name,
      portion: "the whole item, as you logged it",
      kcal: Number(row.kcal),
      proteinG: Number(row.protein_g ?? 0),
      carbsG: Number(row.carbs_g ?? 0),
      fatG: Number(row.fat_g ?? 0),
    });
    if (found.length === MAX_PAST) break;
  }
  return found;
}

// FoodData Central nutrient ids; energy has Atwater variants.
const NUTRIENT_IDS = {
  kcal: [1008, 2047, 2048],
  proteinG: [1003],
  carbsG: [1005],
  fatG: [1004],
} as const;

function per100g(food: DishResult, ids: readonly number[]): number | null {
  for (const id of ids) {
    const n = food.foodNutrients?.find((f) => f.nutrientId === id);
    if (typeof n?.value === "number") return n.value;
  }
  return null;
}

const GRAM_UNITS = new Set(["g", "grm", "ml", "mlt"]);

// Measures that are a fraction of a restaurant serving.
const SMALL_MEASURE =
  /\b(cups?|oz|ounces?|fl|tbsps?|tablespoons?|tsps?|teaspoons?|miniatures?|mini|bites?|pieces?|slices?|grams?|g)\b/i;

// How well a measure stands for one restaurant serving: "1 item", "1 Big
// Mac" best, then FNDDS's "Quantity not specified" (a typical serving), then
// other whole-thing measures, and cups or miniatures last.
function measureScore(text: string): number {
  if (/not specified/i.test(text)) return 2;
  if (SMALL_MEASURE.test(text)) return 0;
  return /^1 /.test(text) ? 3 : 1;
}

// The portion the numbers are for: the measure that best stands for one
// serving, else a branded serving in grams or ml, else 100 g.
export function dishPortion(food: DishResult): {
  label: string;
  grams: number;
} {
  let best: { label: string; grams: number; score: number } | null = null;
  for (const m of food.foodMeasures ?? []) {
    const text = m.disseminationText?.trim();
    if (!text || typeof m.gramWeight !== "number" || m.gramWeight <= 0) {
      continue;
    }
    const score = measureScore(text);
    if (best === null || score > best.score) {
      const name = score === 2 ? "1 serving" : text;
      best = {
        label: `${name} (${Math.round(m.gramWeight)} g)`,
        grams: m.gramWeight,
        score,
      };
    }
  }
  if (best) return { label: best.label, grams: best.grams };
  const unit = food.servingSizeUnit?.toLowerCase();
  if (
    food.servingSize &&
    food.servingSize > 0 &&
    unit &&
    GRAM_UNITS.has(unit)
  ) {
    const amount = `${Math.round(food.servingSize)} ${unit.startsWith("m") ? "ml" : "g"}`;
    const text = food.householdServingFullText?.trim();
    return {
      label: text ? `${text} (${amount})` : amount,
      grams: food.servingSize,
    };
  }
  return { label: "100 g", grams: 100 };
}

export function dishItem(food: DishResult): ItemResult | null {
  const kcal = per100g(food, NUTRIENT_IDS.kcal);
  if (kcal === null) return null;
  const { label, grams } = dishPortion(food);
  const amount = (ids: readonly number[]) =>
    Math.round(((per100g(food, ids) ?? 0) * grams) / 100);
  return {
    source: "usda",
    key: `usda:${food.fdcId}`,
    itemName: food.description,
    restaurantName: food.brandName?.trim() || food.brandOwner?.trim() || null,
    portion: label,
    kcal: Math.round((kcal * grams) / 100),
    proteinG: amount(NUTRIENT_IDS.proteinG),
    carbsG: amount(NUTRIENT_IDS.carbsG),
    fatG: amount(NUTRIENT_IDS.fatG),
  };
}

export async function searchItems(
  supabase: SupabaseClient<Database>,
  usda: Pick<UsdaClient, "searchDishes">,
  query: string,
): Promise<ItemSearch> {
  const past = await pastItems(supabase, query);
  try {
    const wanted = words(query);
    // USDA's order, with foods named by every word of the query first.
    const named = (d: DishResult) => {
      const have = words(`${d.brandName ?? ""} ${d.description}`);
      return wanted.every((w) => have.some((h) => h.startsWith(w)));
    };
    const found = await usda.searchDishes(query);
    const dishes = [...found.filter(named), ...found.filter((d) => !named(d))]
      .map(dishItem)
      .filter((d): d is ItemResult => d !== null);
    return { items: [...past, ...dishes], usdaError: null };
  } catch (err) {
    console.error("USDA eat-out search failed", err);
    return {
      items: past,
      usdaError:
        "USDA search isn't working right now; enter the numbers yourself.",
    };
  }
}
