// The foods cache (TR-8): each food is looked up in the `foods` table by name
// first, and USDA is called only on a miss. Misses that USDA can't match are
// cached too (with no nutrition), so the same name isn't searched again.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FoodRow } from "@/lib/db/types";
import type { UsdaClient } from "@/lib/services/usda";

// "  Boneless Chicken  Thighs. " → "boneless chicken thighs"
export function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, "");
}

export type FoodLookup = (name: string) => Promise<FoodRow | null>;

export function createFoodLookup({
  supabase,
  usda,
  userId,
}: {
  supabase: SupabaseClient<Database>;
  usda: Pick<UsdaClient, "findFood">;
  // Needed with the admin client, which has no signed-in user to default to.
  userId?: string;
}): FoodLookup {
  // Also remembers foods within one run, so a recipe that lists a food twice
  // costs one query.
  const seen = new Map<string, Promise<FoodRow | null>>();

  async function lookup(key: string): Promise<FoodRow | null> {
    const cached = await supabase
      .from("foods")
      .select("*")
      .eq("name", key)
      .maybeSingle();
    if (cached.error) throw new Error(cached.error.message);
    if (cached.data) return cached.data;

    const found = await usda.findFood(key);
    const saved = await supabase
      .from("foods")
      .upsert(
        {
          ...(userId ? { user_id: userId } : {}),
          name: key,
          fdc_id: found?.fdcId ?? null,
          kcal_100g: found?.per100g.kcal ?? null,
          protein_100g: found?.per100g.proteinG ?? null,
          carbs_100g: found?.per100g.carbsG ?? null,
          fat_100g: found?.per100g.fatG ?? null,
          fiber_100g: found?.per100g.fiberG ?? null,
          sugar_100g: found?.per100g.sugarG ?? null,
          sodium_mg_100g: found?.per100g.sodiumMg ?? null,
          grams_per_unit: found?.gramsPerUnit ?? {},
        },
        { onConflict: "user_id,name" },
      )
      .select("*")
      .single();
    if (saved.error) throw new Error(saved.error.message);
    return saved.data;
  }

  return (name: string) => {
    const key = normalizeFoodName(name);
    if (key === "") return Promise.resolve(null);
    let result = seen.get(key);
    if (!result) {
      result = lookup(key);
      seen.set(key, result);
      // A failed lookup can be retried later.
      result.catch(() => seen.delete(key));
    }
    return result;
  };
}
