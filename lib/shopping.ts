// The week's shopping list (US-15 to US-18, TR-15, TR-17): grams of each food
// across every recipe and both batches, rounded up to whole H-E-B packages,
// grouped by store section with a total.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Batch,
  Database,
  HebProductRow,
  ShoppingListItemRow,
  StoreSection,
} from "@/lib/db/types";
import { BATCHES } from "@/lib/batches";
import { ensureProducts } from "@/lib/products";
import { isPlainWater } from "@/lib/typicalWeights";
import { currentItems } from "@/lib/weeks";

type Supabase = SupabaseClient<Database>;

export type ShoppingRecipe = {
  servingsPerDay: number;
  // The recipe's own servings.
  servings: number;
  ingredients: { foodId: number | null; grams: number | null }[];
};

export type ShoppingFood = { id: number; name: string; section: StoreSection };

export type ShoppingProduct = Pick<
  HebProductRow,
  "id" | "food_id" | "name" | "package_grams" | "price_cents" | "is_estimate"
>;

export type ShoppingLine = {
  foodId: number;
  hebProductId: number;
  name: string;
  section: StoreSection;
  neededGrams: number;
  packages: number;
  priceCents: number;
  batch: Batch;
};

// The product to buy for a food: a corrected price first, then the oldest
// estimate.
function productFor(
  products: readonly ShoppingProduct[],
  foodId: number,
): ShoppingProduct | undefined {
  return products
    .filter((p) => p.food_id === foodId && p.package_grams > 0)
    .sort(
      (a, b) => Number(a.is_estimate) - Number(b.is_estimate) || a.id - b.id,
    )[0];
}

// Whole packages for the grams needed; at least one. A hair over a package
// (rounding in the grams) doesn't buy a second one.
export function packagesFor(neededGrams: number, packageGrams: number): number {
  return Math.max(1, Math.ceil(neededGrams / packageGrams - 0.01));
}

// One line per product. Foods sharing a product (green onions and scallions)
// are added together, priced by a corrected product when any of them has
// one. A line notes which batches use it.
export function buildShoppingList(
  recipes: readonly ShoppingRecipe[],
  foods: readonly ShoppingFood[],
  products: readonly ShoppingProduct[],
): ShoppingLine[] {
  type Acc = {
    line: Omit<ShoppingLine, "packages" | "priceCents" | "batch">;
    product: ShoppingProduct;
    batches: Set<Batch>;
  };
  const byProduct = new Map<string, Acc>();

  for (const recipe of recipes) {
    if (!(recipe.servings > 0)) continue;
    for (const { foodId, grams } of recipe.ingredients) {
      if (foodId === null) continue;
      const food = foods.find((f) => f.id === foodId);
      if (!food || isPlainWater(food.name)) continue;
      const product = productFor(products, foodId);
      if (!product) continue;

      const key = `${product.name}|${product.package_grams}`;
      let acc = byProduct.get(key);
      if (!acc) {
        acc = {
          line: {
            foodId,
            hebProductId: product.id,
            name: product.name,
            section: food.section,
            neededGrams: 0,
          },
          product,
          batches: new Set(),
        };
        byProduct.set(key, acc);
      } else if (acc.product.is_estimate && !product.is_estimate) {
        acc.product = product;
        acc.line.foodId = foodId;
        acc.line.hebProductId = product.id;
      }
      for (const b of BATCHES) {
        const perBatch =
          ((grams ?? 0) * recipe.servingsPerDay * b.days) / recipe.servings;
        acc.line.neededGrams += perBatch;
        if (recipe.servingsPerDay > 0) acc.batches.add(b.batch);
      }
    }
  }

  return [...byProduct.values()].map(({ line, product, batches }) => {
    const packages = packagesFor(line.neededGrams, product.package_grams);
    return {
      ...line,
      neededGrams: Math.round(line.neededGrams),
      packages,
      priceCents: packages * product.price_cents,
      batch:
        batches.size === 1 ? ([...batches][0] as Batch) : ("both" as Batch),
    };
  });
}

export const SECTION_ORDER: readonly StoreSection[] = [
  "produce",
  "meat_seafood",
  "dairy_eggs",
  "bakery",
  "pantry",
  "frozen",
  "spices_staples",
];

export const SECTION_LABELS: Record<StoreSection, string> = {
  produce: "Produce",
  meat_seafood: "Meat and seafood",
  dairy_eggs: "Dairy and eggs",
  bakery: "Bakery and tortillas",
  pantry: "Pantry",
  frozen: "Frozen",
  spices_staples: "Spices, oils and sauces",
};

export type ShoppingItemView = {
  id: number;
  name: string;
  neededGrams: number;
  packages: number;
  priceCents: number;
  batch: Batch;
  checked: boolean;
  // False once Jadon has entered what this product really costs.
  estimate: boolean;
};

export type ShoppingList = {
  sections: {
    section: StoreSection;
    label: string;
    items: ShoppingItemView[];
  }[];
  totalCents: number;
};

export function itemView(
  r: ShoppingListItemRow,
  correctedProductIds: ReadonlySet<number> = new Set(),
): ShoppingItemView {
  return {
    id: r.id,
    name: r.name,
    neededGrams: Number(r.needed_grams),
    packages: r.packages,
    priceCents: r.price_cents,
    batch: r.batch,
    checked: r.checked,
    estimate:
      r.heb_product_id === null || !correctedProductIds.has(r.heb_product_id),
  };
}

// Rows grouped by section in store order, names A to Z, with the total.
export function groupShoppingList(
  rows: readonly ShoppingListItemRow[],
  correctedProductIds: ReadonlySet<number> = new Set(),
): ShoppingList {
  const sections = SECTION_ORDER.map((section) => ({
    section,
    label: SECTION_LABELS[section],
    items: rows
      .filter((r) => r.section === section)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => itemView(r, correctedProductIds)),
  })).filter((s) => s.items.length > 0);
  return {
    sections,
    totalCents: rows.reduce((t, r) => t + r.price_cents, 0),
  };
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Builds the week's list from its plan items and writes it, replacing any
// list it had. Returns the rows written.
export async function writeShoppingList(
  supabase: Supabase,
  weekId: number,
): Promise<number> {
  // TR-30: only each slot's current dish.
  const picks =
    check(
      await supabase
        .from("plan_candidates")
        .select("slot, recipe_id")
        .eq("week_plan_id", weekId)
        .eq("selected", true),
    ) ?? [];
  const items = currentItems(
    check(
      await supabase
        .from("plan_items")
        .select("id, slot, recipe_id, servings_per_day")
        .eq("week_plan_id", weekId),
    ) ?? [],
    picks,
  );
  const recipeIds = items.map((i) => i.recipe_id);
  const recipes =
    recipeIds.length === 0
      ? []
      : (check(
          await supabase
            .from("recipes")
            .select("id, servings")
            .in("id", recipeIds),
        ) ?? []);
  const lines =
    recipeIds.length === 0
      ? []
      : (check(
          await supabase
            .from("recipe_ingredients")
            .select("recipe_id, food_id, grams")
            .in("recipe_id", recipeIds),
        ) ?? []);
  const foodIds = [
    ...new Set(
      lines.map((l) => l.food_id).filter((id): id is number => id !== null),
    ),
  ];
  await ensureProducts(supabase, foodIds);
  const foods =
    foodIds.length === 0
      ? []
      : (check(
          await supabase
            .from("foods")
            .select("id, name, section")
            .in("id", foodIds),
        ) ?? []);
  const products =
    foodIds.length === 0
      ? []
      : (check(
          await supabase
            .from("heb_products")
            .select(
              "id, food_id, name, package_grams, price_cents, is_estimate",
            )
            .in("food_id", foodIds),
        ) ?? []);

  const list = buildShoppingList(
    items.map((item) => ({
      servingsPerDay: Number(item.servings_per_day),
      servings: Number(
        recipes.find((r) => r.id === item.recipe_id)?.servings ?? 0,
      ),
      ingredients: lines
        .filter((l) => l.recipe_id === item.recipe_id)
        .map((l) => ({
          foodId: l.food_id,
          grams: l.grams === null ? null : Number(l.grams),
        })),
    })),
    foods,
    products.map((p) => ({
      ...p,
      package_grams: Number(p.package_grams),
    })),
  );

  check(
    await supabase
      .from("shopping_list_items")
      .delete()
      .eq("week_plan_id", weekId),
  );
  if (list.length > 0) {
    check(
      await supabase.from("shopping_list_items").insert(
        list.map((l) => ({
          week_plan_id: weekId,
          food_id: l.foodId,
          heb_product_id: l.hebProductId,
          name: l.name,
          section: l.section,
          needed_grams: l.neededGrams,
          packages: l.packages,
          price_cents: l.priceCents,
          batch: l.batch,
        })),
      ),
    );
  }
  return list.length;
}

// The week's list. A finalized week with no list yet (finalized before
// lists existed) gets one built now.
export async function shoppingListForWeek(
  supabase: Supabase,
  week: { id: number; status: string },
): Promise<ShoppingList> {
  const read = async () =>
    check(
      await supabase
        .from("shopping_list_items")
        .select("*")
        .eq("week_plan_id", week.id),
    ) ?? [];
  let rows = await read();
  if (rows.length === 0 && week.status === "final") {
    await writeShoppingList(supabase, week.id);
    rows = await read();
  }
  return groupShoppingList(rows, await correctedIds(supabase, rows));
}

// The rows' products whose price Jadon has corrected.
async function correctedIds(
  supabase: Supabase,
  rows: readonly Pick<ShoppingListItemRow, "heb_product_id">[],
): Promise<Set<number>> {
  const ids = [
    ...new Set(
      rows
        .map((r) => r.heb_product_id)
        .filter((id): id is number => id !== null),
    ),
  ];
  if (ids.length === 0) return new Set();
  const products =
    check(
      await supabase
        .from("heb_products")
        .select("id, is_estimate")
        .in("id", ids),
    ) ?? [];
  return new Set(products.filter((p) => !p.is_estimate).map((p) => p.id));
}

export type ShoppingItemPatch = {
  checked?: boolean;
  // What the line really cost, all its packages together.
  actualPriceCents?: number;
};

// `{ checked }` and/or `{ actualPriceCents }` (whole cents, up to $1,000).
export function parseShoppingPatch(
  body: unknown,
): { ok: true; patch: ShoppingItemPatch } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Send { checked } or { actualPriceCents }." };
  }
  const { checked, actualPriceCents } = body as Record<string, unknown>;
  const patch: ShoppingItemPatch = {};
  if (checked !== undefined) {
    if (typeof checked !== "boolean") {
      return { ok: false, error: "checked must be true or false." };
    }
    patch.checked = checked;
  }
  if (actualPriceCents !== undefined) {
    if (
      typeof actualPriceCents !== "number" ||
      !Number.isInteger(actualPriceCents) ||
      actualPriceCents < 0 ||
      actualPriceCents > 100_000
    ) {
      return {
        ok: false,
        error: "The price paid must be between $0 and $1,000.",
      };
    }
    patch.actualPriceCents = actualPriceCents;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Send { checked } or { actualPriceCents }." };
  }
  return { ok: true, patch };
}

export class ShoppingItemNotFound extends Error {
  name = "ShoppingItemNotFound";
}

// US-19: checks an item off, and/or records what it really cost. A price
// paid sets the line's price and becomes its product's price per package
// (`is_estimate` false), so later weeks use it. Other estimated products
// with the same name and package, from foods sharing the line, get it too.
export async function updateShoppingItem(
  supabase: Supabase,
  id: number,
  patch: ShoppingItemPatch,
): Promise<ShoppingItemView> {
  const row = check(
    await supabase
      .from("shopping_list_items")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
  );
  if (!row) throw new ShoppingItemNotFound("Item not found");

  const changes: Partial<ShoppingListItemRow> = {};
  if (patch.checked !== undefined) changes.checked = patch.checked;
  if (patch.actualPriceCents !== undefined) {
    changes.price_cents = patch.actualPriceCents;
    if (row.heb_product_id !== null) {
      const product = check(
        await supabase
          .from("heb_products")
          .select("*")
          .eq("id", row.heb_product_id)
          .maybeSingle(),
      );
      if (product) {
        const corrected = {
          price_cents: Math.round(patch.actualPriceCents / row.packages),
          is_estimate: false,
        };
        check(
          await supabase
            .from("heb_products")
            .update(corrected)
            .eq("id", product.id),
        );
        check(
          await supabase
            .from("heb_products")
            .update(corrected)
            .eq("name", product.name)
            .eq("package_grams", product.package_grams)
            .eq("is_estimate", true),
        );
      }
    }
  }
  check(
    await supabase.from("shopping_list_items").update(changes).eq("id", id),
  );
  const updated = { ...row, ...changes };
  return itemView(updated, await correctedIds(supabase, [updated]));
}
