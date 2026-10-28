// Build step 10 "done when": a recipe URL is stored with nutrition, and pages
// without recipe data are skipped. The page and USDA are faked here; the live
// check runs on Jadon's PC.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { FoodRow } from "@/lib/db/types";
import { saveRecipeFromUrl } from "@/lib/recipes";
import { extractRecipe } from "@/lib/services/recipePage";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

const URL_ = "https://www.example-recipes.com/recipe/123/garlic-butter-salmon/";

function savedPage(name: string) {
  const html = readFileSync(`tests/fixtures/recipe-pages/${name}.html`, "utf8");
  return vi.fn(async (url: string) => extractRecipe(html, url));
}

let nextFoodId = 100;
function foodRow(
  name: string,
  per100g: [number, number, number, number],
  gramsPerUnit: Record<string, number> = {},
): FoodRow {
  const [kcal, protein, carbs, fat] = per100g;
  return {
    id: nextFoodId++,
    user_id: "u1",
    name,
    fdc_id: 1,
    kcal_100g: kcal,
    protein_100g: protein,
    carbs_100g: carbs,
    fat_100g: fat,
    fiber_100g: 0,
    sugar_100g: 0,
    sodium_mg_100g: 0,
    grams_per_unit: gramsPerUnit,
    section: "pantry",
    created_at: "",
    updated_at: "",
  };
}

// Foods for the salmon recipe; parsley is left unmatched.
const FOODS: Record<string, FoodRow> = {
  "salmon fillets": foodRow("salmon fillets", [208, 20, 0, 13]),
  butter: foodRow("butter", [717, 0.9, 0.1, 81], { tbsp: 14.2 }),
  garlic: foodRow("garlic", [149, 6.4, 33, 0.5], { clove: 3 }),
  "lemon juice": foodRow("lemon juice", [22, 0.4, 6.9, 0.2], { tbsp: 15.25 }),
  salt: foodRow("salt", [0, 0, 0, 0], { tsp: 6 }),
};

function fakeLookup() {
  return vi.fn(async (name: string) => FOODS[name] ?? null);
}

describe("saveRecipeFromUrl", () => {
  it("stores a recipe with nutrition per serving and its ingredients", async () => {
    const db = fakeRecipeTables();

    const result = await saveRecipeFromUrl({
      supabase: db.client,
      url: URL_,
      lookup: fakeLookup(),
      readPage: savedPage("publisher-array"),
    });

    expect(result.status).toBe("saved");
    const [recipe] = db.recipes();
    // Per serving of 4: 4 × 170 g salmon, 3 tbsp butter, 4 cloves garlic,
    // 1.5 tbsp lemon juice, salt; parsley unmatched. Totals 1743.5 kcal,
    // 137.3 g protein, 5.6 g carbs, 123.1 g fat.
    expect(recipe).toMatchObject({
      source_url: URL_,
      title: "Garlic Butter Salmon",
      photo_url: "https://images.example-recipes.com/salmon/4x3.jpg",
      cuisine: "Seafood",
      servings: 4,
      active_minutes: 80,
      kcal: 436,
      protein_g: 34.3,
      carbs_g: 1.4,
      fat_g: 30.8,
    });
    expect(recipe.steps).toHaveLength(3);

    const ingredients = db.ingredients();
    expect(ingredients).toHaveLength(6);
    expect(ingredients[0]).toMatchObject({
      recipe_id: recipe.id,
      raw_text: "4 (6 ounce) salmon fillets",
      food_id: FOODS["salmon fillets"].id,
      quantity: 4,
      unit: null,
      grams: 680.4,
    });
    expect(ingredients[5]).toMatchObject({
      raw_text: "2 tablespoons chopped fresh parsley",
      food_id: null,
      grams: null,
    });
    expect(result.status === "saved" && result.missing).toEqual([
      { raw: "2 tablespoons chopped fresh parsley", reason: "no food match" },
    ]);
  });

  it("doesn't fetch a page that's already stored", async () => {
    const db = fakeRecipeTables();
    const readPage = savedPage("publisher-array");
    const lookup = fakeLookup();
    await saveRecipeFromUrl({
      supabase: db.client,
      url: URL_,
      lookup,
      readPage,
    });

    const again = await saveRecipeFromUrl({
      supabase: db.client,
      url: URL_,
      lookup,
      readPage,
    });

    expect(again.status).toBe("exists");
    expect(readPage).toHaveBeenCalledTimes(1);
    expect(db.recipes()).toHaveLength(1);
    expect(db.ingredients()).toHaveLength(6);
  });

  it("skips a page without recipe data", async () => {
    const db = fakeRecipeTables();
    const lookup = fakeLookup();

    const result = await saveRecipeFromUrl({
      supabase: db.client,
      url: "https://blog.example.com/tips/",
      lookup,
      readPage: savedPage("no-recipe"),
    });

    expect(result).toEqual({ status: "skipped", reason: "no recipe data" });
    expect(db.recipes()).toHaveLength(0);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("skips a recipe that doesn't say how many it serves", async () => {
    const db = fakeRecipeTables();
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Rice","recipeIngredient":["1 cup rice"]}</script>`;

    const result = await saveRecipeFromUrl({
      supabase: db.client,
      url: "https://x.test/rice",
      lookup: fakeLookup(),
      readPage: async (url) => extractRecipe(html, url),
    });

    expect(result).toEqual({ status: "skipped", reason: "no servings" });
    expect(db.recipes()).toHaveLength(0);
  });

  it("keeps unparsed lines but not headings", async () => {
    const db = fakeRecipeTables();
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Salad","recipeYield":"2","recipeIngredient":["For the dressing:","1 tbsp butter","a handful of love"]}</script>`;

    await saveRecipeFromUrl({
      supabase: db.client,
      url: "https://x.test/salad",
      lookup: fakeLookup(),
      readPage: async (url) => extractRecipe(html, url),
    });

    expect(db.ingredients().map((i) => i.raw_text)).toEqual([
      "1 tbsp butter",
      "a handful of love",
    ]);
    expect(db.ingredients()[1]).toMatchObject({ food_id: null, grams: null });
  });

  it("removes the recipe again when its ingredients can't be saved", async () => {
    const db = fakeRecipeTables({ failIngredientInsert: true });

    await expect(
      saveRecipeFromUrl({
        supabase: db.client,
        url: URL_,
        lookup: fakeLookup(),
        readPage: savedPage("publisher-array"),
      }),
    ).rejects.toThrow("insert failed");
    expect(db.recipes()).toHaveLength(0);
  });
});
