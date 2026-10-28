// Build step 11 "done when": a function returns the top 3 ranked recipes for
// a cuisine and slot. Brave, the recipe pages and USDA are faked here; the
// live check runs on Jadon's PC.

import { describe, expect, it, vi } from "vitest";
import type { FoodRow } from "@/lib/db/types";
import {
  findTopRecipes,
  mightBeRecipePage,
  previousWeekRecipeIds,
  previousWeekStart,
  searchQuery,
} from "@/lib/recipeSearch";
import { RecipePageError, type RecipePage } from "@/lib/services/recipePage";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function food(
  id: number,
  name: string,
  kcal: number,
  protein: number,
): FoodRow {
  return {
    id,
    user_id: "u1",
    name,
    fdc_id: id,
    kcal_100g: kcal,
    protein_100g: protein,
    carbs_100g: 0,
    fat_100g: 0,
    fiber_100g: 0,
    sugar_100g: 0,
    sodium_mg_100g: 0,
    grams_per_unit: {},
    section: "pantry",
    created_at: "",
    updated_at: "",
  };
}

const FOODS: Record<string, FoodRow> = {
  "chicken breast": food(1, "chicken breast", 120, 22.5),
  rice: food(2, "rice", 130, 2.7),
  paneer: food(3, "paneer", 320, 20),
  lentils: food(4, "lentils", 116, 9),
};

// $1.00 per 100 g chicken, $0.20 per 100 g rice, $1.50 per 100 g paneer,
// $0.30 per 100 g lentils.
const PRODUCTS = [
  { id: 1, food_id: 1, package_grams: 454, price_cents: 454 },
  { id: 2, food_id: 2, package_grams: 907, price_cents: 181 },
  { id: 3, food_id: 3, package_grams: 200, price_cents: 300 },
  { id: 4, food_id: 4, package_grams: 454, price_cents: 136 },
];

function page(
  url: string,
  title: string,
  ingredients: string[],
  fields: Partial<RecipePage> = {},
): RecipePage {
  return {
    url,
    title,
    photoUrl: null,
    servings: 2,
    cuisine: "Indian",
    ingredients,
    steps: ["Cook."],
    prepMinutes: 10,
    cookMinutes: 20,
    totalMinutes: 30,
    activeMinutes: 30,
    ...fields,
  };
}

const PAGES: Record<string, RecipePage | null | Error> = {
  "https://a.test/tandoori": page(
    "https://a.test/tandoori",
    "Tandoori chicken and rice",
    ["500 g chicken breast", "200 g rice"],
  ),
  "https://b.test/paneer": page("https://b.test/paneer", "Paneer rice bowl", [
    "300 g paneer",
    "200 g rice",
  ]),
  "https://c.test/dal": page("https://c.test/dal", "Dal", [
    "400 g lentils",
    "200 g rice",
  ]),
  "https://d.test/biryani": page(
    "https://d.test/biryani",
    "Slow biryani",
    ["500 g chicken breast"],
    {
      activeMinutes: 120,
    },
  ),
  "https://e.test/pasta": page(
    "https://e.test/pasta",
    "Chicken pasta",
    ["600 g chicken breast"],
    {
      cuisine: "Italian",
    },
  ),
  "https://f.test/listicle": null,
  "https://g.test/blocked": new RecipePageError(
    "Couldn't fetch https://g.test/blocked: 403 Forbidden",
  ),
};

function fakes() {
  const brave = {
    search: vi.fn(async () => Object.keys(PAGES)),
  };
  const readPage = vi.fn(async (url: string) => {
    const p = PAGES[url];
    if (p instanceof Error) throw p;
    return p ?? null;
  });
  const lookup = vi.fn(async (name: string) => FOODS[name] ?? null);
  return { brave, readPage, lookup };
}

describe("findTopRecipes", () => {
  it("returns the top 3 ranked recipes for a cuisine and slot", async () => {
    const db = fakeRecipeTables({ seed: { heb_products: PRODUCTS } });
    const { brave, readPage, lookup } = fakes();

    const result = await findTopRecipes({
      supabase: db.client,
      brave,
      lookup,
      readPage,
      slot: "dinner",
      cuisines: ["Indian"],
    });

    expect(brave.search).toHaveBeenCalledWith(
      "Indian high protein dinner recipe",
      20,
    );
    // Per serving (protein per 100 kcal, cost):
    //   Tandoori 430 kcal, 13.7 g, $2.70   Dal    362 kcal, 5.7 g, $0.80
    //   Paneer   610 kcal,  5.4 g, $2.45   Pasta  360 kcal, 18.8 g, $3.00
    // Scores: Dal 0.4 + 0.35 × 0.03 + 0.25 × 1 = 0.659; Tandoori 0.4 +
    // 0.35 × 0.62 + 0.25 × 0.14 = 0.653; Paneer 0.4 + 0 + 0.25 × 0.25 =
    // 0.463; Italian pasta 0 + 0.35 + 0 = 0.35. Biryani is over an hour.
    expect(result.top.map((r) => [r.recipe.title, r.score])).toEqual([
      ["Dal", 0.659],
      ["Tandoori chicken and rice", 0.653],
      ["Paneer rice bowl", 0.463],
    ]);
    expect(result.top[1].recipe).toMatchObject({
      kcal: 430,
      cost_cents_per_serving: 270,
    });
    expect(
      db.recipes().find((r) => r.title === "Dal")?.cost_cents_per_serving,
    ).toBe(80);
    expect(result.recipes).toHaveLength(5);
    expect(result.skipped).toEqual([
      { url: "https://f.test/listicle", reason: "no recipe data" },
      {
        url: "https://g.test/blocked",
        reason: "Couldn't fetch https://g.test/blocked: 403 Forbidden",
      },
    ]);
  });

  it("leaves out last week's recipes and reuses stored ones", async () => {
    const db = fakeRecipeTables({ seed: { heb_products: PRODUCTS } });
    const first = fakes();
    const run = (excludedIds?: Set<number>) =>
      findTopRecipes({
        supabase: db.client,
        brave: first.brave,
        lookup: first.lookup,
        readPage: first.readPage,
        slot: "dinner",
        cuisines: ["Indian"],
        excludedIds,
      });
    const before = await run();
    const tandoori = before.top.find((r) =>
      r.recipe.title.startsWith("Tandoori"),
    )!.recipe;
    const pagesRead = first.readPage.mock.calls.length;

    const after = await run(new Set([tandoori.id]));

    expect(after.top.map((r) => r.recipe.title)).toEqual([
      "Dal",
      "Paneer rice bowl",
      "Chicken pasta",
    ]);
    // Stored recipes aren't fetched again; only the skipped pages are.
    expect(first.readPage.mock.calls.length - pagesRead).toBe(2);
  });

  it("splits the results between several cuisines", async () => {
    const db = fakeRecipeTables();
    const { brave, readPage, lookup } = fakes();
    brave.search.mockResolvedValue([]);

    await findTopRecipes({
      supabase: db.client,
      brave,
      lookup,
      readPage,
      slot: "snack",
      cuisines: ["Indian", "Thai"],
    });

    expect(brave.search.mock.calls).toEqual([
      ["Indian high protein snack recipe", 10],
      ["Thai high protein snack recipe", 10],
    ]);
  });
});

describe("mightBeRecipePage", () => {
  it.each([
    "https://www.youtube.com/watch?v=abc",
    "https://m.youtube.com/watch?v=abc",
    "https://www.pinterest.com/pin/123/",
    "https://blog.test/category/high-protein-indian-recipes/",
    "https://blog.test/tag/dinner",
    "https://blog.test/menu.pdf",
    "not a url",
  ])("skips %s", (url) => {
    expect(mightBeRecipePage(url)).toBe(false);
  });

  it.each([
    "https://cookieandkate.com/best-lentil-soup-recipe/",
    "https://www.recipetineats.com/chicken-stir-fry/",
    "https://blog.test/recipes/tagine/",
  ])("keeps %s", (url) => {
    expect(mightBeRecipePage(url)).toBe(true);
  });
});

describe("searchQuery", () => {
  it("builds the search from the cuisine and slot", () => {
    expect(searchQuery("breakfast", "Mexican")).toBe(
      "Mexican high protein breakfast recipe",
    );
    expect(searchQuery("lunch")).toBe("high protein lunch recipe");
  });
});

describe("previousWeekRecipeIds", () => {
  it("lists the recipes planned for the week before", async () => {
    expect(previousWeekStart("2026-11-01")).toBe("2026-10-25");
    const db = fakeRecipeTables({
      seed: {
        week_plans: [
          { id: 7, week_start: "2026-10-25" },
          { id: 8, week_start: "2026-10-18" },
        ],
        plan_items: [
          { week_plan_id: 7, recipe_id: 11 },
          { week_plan_id: 7, recipe_id: 12 },
          { week_plan_id: 8, recipe_id: 13 },
        ],
      },
    });

    expect(await previousWeekRecipeIds(db.client, "2026-11-01")).toEqual(
      new Set([11, 12]),
    );
    expect(await previousWeekRecipeIds(db.client, "2026-10-04")).toEqual(
      new Set(),
    );
  });
});
