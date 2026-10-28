// Every priced food has an H-E-B product (TR-16). A food gets its row the
// first time it's priced: from the catalog when its name matches, otherwise
// an estimate from its section's default price per gram. The food's store
// section is set at the same time.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { estimateProduct } from "@/lib/hebCatalog";

// Creates the missing `heb_products` rows for these foods. Returns how many
// it created.
export async function ensureProducts(
  supabase: SupabaseClient<Database>,
  foodIds: readonly number[],
): Promise<number> {
  const ids = [...new Set(foodIds)];
  if (ids.length === 0) return 0;

  const existing = await supabase
    .from("heb_products")
    .select("food_id")
    .in("food_id", ids);
  if (existing.error) throw new Error(existing.error.message);
  const priced = new Set((existing.data ?? []).map((p) => p.food_id));
  const missing = ids.filter((id) => !priced.has(id));
  if (missing.length === 0) return 0;

  const foods = await supabase
    .from("foods")
    .select("id, name, section")
    .in("id", missing);
  if (foods.error) throw new Error(foods.error.message);

  const rows = (foods.data ?? []).map((food) => ({
    food,
    product: estimateProduct(food.name),
  }));
  if (rows.length === 0) return 0;

  const inserted = await supabase.from("heb_products").insert(
    rows.map(({ food, product }) => ({
      food_id: food.id,
      name: product.name,
      package_grams: product.packageGrams,
      price_cents: product.priceCents,
    })),
  );
  if (inserted.error) throw new Error(inserted.error.message);

  for (const { food, product } of rows) {
    if (food.section === product.section) continue;
    const updated = await supabase
      .from("foods")
      .update({ section: product.section })
      .eq("id", food.id);
    if (updated.error) throw new Error(updated.error.message);
  }
  return rows.length;
}
