// Build step 15 "done when": every food used in a plan maps to a product.

import { describe, expect, it } from "vitest";
import { updateRecipeCosts } from "@/lib/cost";
import { finalizeWeek } from "@/lib/plans";
import { ensureProducts } from "@/lib/products";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function recipe(id: number, kcal: number) {
  return {
    id,
    title: `Recipe ${id}`,
    source_url: `https://x.test/${id}`,
    photo_url: null,
    cuisine: "Mexican",
    servings: 4,
    active_minutes: 30,
    steps: [],
    kcal,
    protein_g: 30,
    carbs_g: 40,
    fat_g: 15,
    cost_cents_per_serving: null,
  };
}

const FOODS = [
  { id: 1, name: "chicken breasts", section: "pantry" },
  { id: 2, name: "black beans", section: "pantry" },
  { id: 3, name: "corn tortillas", section: "pantry" },
  { id: 4, name: "eggs", section: "pantry" },
  { id: 5, name: "dragon fruit", section: "pantry" },
  { id: 6, name: "ground lamb", section: "pantry" },
  { id: 7, name: "greek yogurt", section: "pantry" },
  { id: 8, name: "salt", section: "pantry" },
];

function week() {
  return fakeRecipeTables({
    seed: {
      week_plans: [{ id: 1, week_start: "2026-11-01", status: "draft" }],
      recipes: [recipe(1, 400), recipe(2, 600), recipe(3, 700), recipe(4, 250)],
      foods: FOODS,
      // Eggs already have a corrected price, which is kept.
      heb_products: [
        {
          id: 1,
          food_id: 4,
          name: "Large eggs, 18 ct",
          package_grams: 900,
          price_cents: 429,
          is_estimate: false,
        },
      ],
      recipe_ingredients: [
        { id: 1, recipe_id: 1, food_id: 4, grams: 200 },
        { id: 2, recipe_id: 1, food_id: 3, grams: 104 },
        { id: 3, recipe_id: 2, food_id: 1, grams: 500 },
        { id: 4, recipe_id: 2, food_id: 2, grams: 425 },
        { id: 5, recipe_id: 2, food_id: 8, grams: 3 },
        { id: 6, recipe_id: 3, food_id: 6, grams: 450 },
        { id: 7, recipe_id: 3, food_id: 5, grams: 200 },
        { id: 8, recipe_id: 4, food_id: 7, grams: 400 },
        { id: 9, recipe_id: 4, food_id: null, grams: null },
      ],
      plan_candidates: ["breakfast", "lunch", "dinner", "snack"].map(
        (slot, i) => ({
          id: i + 1,
          week_plan_id: 1,
          slot,
          recipe_id: i + 1,
          rank: 1,
          selected: true,
        }),
      ),
    },
  });
}

describe("H-E-B products for a plan", () => {
  it("gives every food in a finalized plan a product", async () => {
    const db = week();
    await finalizeWeek(db.client, 1, { kcal: 3000, proteinG: 150 });

    const products = db.table("heb_products");
    for (const food of FOODS) {
      expect(
        products.filter((p) => p.food_id === food.id),
        food.name,
      ).toHaveLength(1);
    }
    // The corrected price stays as it was.
    expect(products.find((p) => p.food_id === 4)).toMatchObject({
      price_cents: 429,
      is_estimate: false,
    });
    expect(products.find((p) => p.food_id === 1)).toMatchObject({
      name: "Chicken breasts, boneless skinless, per lb",
      package_grams: 454,
      price_cents: 399,
      is_estimate: true,
    });
    expect(products.find((p) => p.food_id === 5)).toMatchObject({
      name: "dragon fruit (estimated)",
      is_estimate: true,
    });

    // Foods are placed in their store sections.
    const sections = Object.fromEntries(
      db.table("foods").map((f) => [f.name, f.section]),
    );
    expect(sections).toEqual({
      "chicken breasts": "meat_seafood",
      "black beans": "pantry",
      "corn tortillas": "bakery",
      eggs: "pantry", // already priced, so left as it was
      "dragon fruit": "pantry",
      "ground lamb": "meat_seafood",
      "greek yogurt": "dairy_eggs",
      salt: "spices_staples",
    });
  });

  it("lets every recipe be priced, so none ranks as unknown cost", async () => {
    const db = week();
    const costs = await updateRecipeCosts(db.client, [
      { id: 1, servings: 4 },
      { id: 2, servings: 4 },
      { id: 3, servings: 4 },
      { id: 4, servings: 4 },
    ]);
    expect([...costs.values()].every((c) => typeof c === "number")).toBe(true);
    // 500 g chicken at 399¢/454 g + 425 g beans at 99¢ + 3 g salt at
    // 99¢/737 g, over 4 servings.
    expect(costs.get(2)).toBe(
      Math.round((500 * (399 / 454) + 99 + 3 * (99 / 737)) / 4),
    );
  });

  it("creates nothing when every food already has a product", async () => {
    const db = week();
    expect(await ensureProducts(db.client, [1, 2, 2])).toBe(2);
    expect(await ensureProducts(db.client, [1, 2])).toBe(0);
    expect(await ensureProducts(db.client, [])).toBe(0);
    // A food id with no food row is skipped.
    expect(await ensureProducts(db.client, [99])).toBe(0);
    expect(db.table("heb_products")).toHaveLength(3);
  });
});
