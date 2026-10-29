// Build step 14a "done when": with a 3–5 range, every shortlisted recipe has
// 3 to 5 counted ingredients.

import { describe, expect, it, vi } from "vitest";
import type { FoodRow } from "@/lib/db/types";
import { countIngredients } from "@/lib/ingredientCount";
import { searchSlot, startWeek } from "@/lib/plans";
import type { RecipePage } from "@/lib/services/recipePage";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

const chicken: FoodRow = {
  id: 1,
  user_id: "u1",
  name: "chicken",
  fdc_id: 1,
  kcal_100g: 150,
  protein_100g: 25,
  carbs_100g: 5,
  fat_100g: 5,
  fiber_100g: 0,
  sugar_100g: 0,
  sodium_mg_100g: 0,
  grams_per_unit: {},
  section: "pantry",
  created_at: "",
  updated_at: "",
};

// A recipe with `n` counted ingredients, plus salt and olive oil.
function page(n: number): RecipePage {
  const url = `https://r.test/${n}-ingredients`;
  return {
    url,
    title: `${n}-ingredient chicken`,
    photoUrl: null,
    servings: 2,
    cuisine: "Chinese",
    ingredients: [
      ...Array.from({ length: n }, (_, i) => `100 g chicken part ${i + 1}`),
      "1 tsp salt",
      "1 tbsp olive oil",
    ],
    steps: ["Cook."],
    prepMinutes: 10,
    cookMinutes: 20,
    totalMinutes: 30,
    activeMinutes: 30,
  };
}

const PAGES = [2, 3, 4, 5, 6, 8].map(page);

async function shortlist(range: { min: number | null; max: number | null }) {
  const db = fakeRecipeTables({
    seed: {
      profile: [{ min_ingredients: range.min, max_ingredients: range.max }],
    },
  });
  const week = await startWeek(db.client, {
    weekStart: "2026-11-08",
    cuisines: ["Chinese"],
  });
  const result = await searchSlot({
    supabase: db.client,
    weekId: week.id,
    slot: "dinner",
    brave: { search: vi.fn(async () => PAGES.map((p) => p.url)) },
    readPage: async (url) => PAGES.find((p) => p.url === url) ?? null,
    lookup: async () => chicken,
    wait: async () => {},
  });
  return result.candidates.map((c) => countIngredients(c.recipe.ingredients));
}

describe("ingredient range", () => {
  it("only shortlists recipes within the range", async () => {
    const counts = await shortlist({ min: 3, max: 5 });
    expect(counts.sort()).toEqual([3, 4, 5]);
  });

  it("takes an open end", async () => {
    expect((await shortlist({ min: null, max: 3 })).sort()).toEqual([2, 3]);
  });

  it("doesn't limit without a range", async () => {
    expect(await shortlist({ min: null, max: null })).toHaveLength(
      PAGES.length,
    );
  });
});
