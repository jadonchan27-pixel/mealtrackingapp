// Build step 16 "done when": the list for a finalized plan shows packages,
// prices, batch marks and a total.

import { describe, expect, it } from "vitest";
import { finalizeWeek } from "@/lib/plans";
import { shoppingListForWeek, writeShoppingList } from "@/lib/shopping";
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

function week() {
  return fakeRecipeTables({
    seed: {
      week_plans: [{ id: 1, week_start: "2026-11-01", status: "draft" }],
      recipes: [recipe(1, 400), recipe(2, 600), recipe(3, 700), recipe(4, 250)],
      foods: [
        { id: 1, name: "eggs", section: "pantry" },
        { id: 2, name: "corn tortillas", section: "pantry" },
        { id: 3, name: "chicken breasts", section: "pantry" },
        { id: 4, name: "black beans", section: "pantry" },
        { id: 5, name: "salt", section: "pantry" },
        { id: 6, name: "ground beef", section: "pantry" },
        { id: 7, name: "greek yogurt", section: "pantry" },
      ],
      recipe_ingredients: [
        { id: 1, recipe_id: 1, food_id: 1, grams: 400 },
        { id: 2, recipe_id: 1, food_id: 2, grams: 208 },
        { id: 3, recipe_id: 2, food_id: 3, grams: 900 },
        { id: 4, recipe_id: 2, food_id: 4, grams: 425 },
        { id: 5, recipe_id: 2, food_id: 5, grams: null },
        { id: 6, recipe_id: 3, food_id: 6, grams: 900 },
        { id: 7, recipe_id: 3, food_id: 2, grams: 104 },
        { id: 8, recipe_id: 4, food_id: 7, grams: 600 },
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

describe("shopping list for a finalized plan", () => {
  it("shows packages, prices, batch marks and a total", async () => {
    const db = week();
    const final = await finalizeWeek(db.client, 1, {
      kcal: 3000,
      proteinG: 150,
    });
    await writeShoppingList(db.client, 1);
    const list = await shoppingListForWeek(db.client, final);

    expect(list.sections.map((s) => s.section)).toEqual([
      "meat_seafood",
      "dairy_eggs",
      "bakery",
      "pantry",
      "spices_staples",
    ]);
    const items = list.sections.flatMap((s) => s.items);
    expect(items).toHaveLength(7);
    for (const item of items) {
      expect(item.packages).toBeGreaterThanOrEqual(1);
      expect(item.priceCents).toBeGreaterThan(0);
      expect(item.batch).toBe("both");
      expect(item.checked).toBe(false);
    }
    expect(list.totalCents).toBe(items.reduce((t, i) => t + i.priceCents, 0));

    // Tortillas from breakfast and dinner are one line: servings per day ×
    // 7 ÷ 4 of each recipe's tortillas, in 30-count (780 g) packs.
    const servings = Object.fromEntries(
      final.items.map((i) => [i.recipe.id, i.servingsPerDay]),
    );
    const tortillaGrams =
      (208 * servings[1] * 7) / 4 + (104 * servings[3] * 7) / 4;
    const tortillas = items.find((i) => i.name.startsWith("Corn tortillas"))!;
    expect(tortillas.neededGrams).toBe(Math.round(tortillaGrams));
    expect(tortillas.packages).toBe(Math.ceil(tortillaGrams / 780 - 0.01));
    expect(tortillas.priceCents).toBe(tortillas.packages * 249);

    // Salt with no amount is one package.
    expect(items.find((i) => i.name.startsWith("Iodized salt"))).toMatchObject({
      packages: 1,
      priceCents: 99,
    });
  });

  it("builds the list on first view for a week finalized without one", async () => {
    const db = week();
    const final = await finalizeWeek(db.client, 1, {
      kcal: 3000,
      proteinG: 150,
    });
    expect(db.table("shopping_list_items")).toHaveLength(0);
    const list = await shoppingListForWeek(db.client, final);
    expect(list.sections.flatMap((s) => s.items)).toHaveLength(7);
    expect(db.table("shopping_list_items")).toHaveLength(7);

    // Writing again replaces the list instead of adding to it.
    await writeShoppingList(db.client, 1);
    expect(db.table("shopping_list_items")).toHaveLength(7);
  });

  it("is empty for a draft", async () => {
    const db = week();
    const list = await shoppingListForWeek(db.client, {
      id: 1,
      status: "draft",
    });
    expect(list).toEqual({ sections: [], totalCents: 0 });
  });
});
