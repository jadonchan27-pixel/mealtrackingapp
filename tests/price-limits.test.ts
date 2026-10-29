// Build step 20b "done when": with a cap, every shortlisted meal is at or
// under it, unpriced or marked over; the shopping list total shows against
// the budget.

import { describe, expect, it, vi } from "vitest";
import type { FoodRow } from "@/lib/db/types";
import { searchSlot, startWeek } from "@/lib/plans";
import { costTag, mealCostCents } from "@/lib/priceLimits";
import type { RecipePage } from "@/lib/services/recipePage";
import { targetsForProfile } from "@/lib/targets";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function food(id: number, name: string, kcal: number): FoodRow {
  return {
    id,
    user_id: "u1",
    name,
    fdc_id: id,
    kcal_100g: kcal,
    protein_100g: 10,
    carbs_100g: 5,
    fat_100g: 2,
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
  "chicken breast": food(1, "chicken breast", 165),
  spinach: food(2, "spinach", 23),
};

// More spinach makes a lighter dish, so a bigger, pricier portion.
function page(spinachGrams: number): RecipePage {
  const url = `https://r.test/spinach-${spinachGrams}`;
  return {
    url,
    title: `Chicken with ${spinachGrams} g spinach`,
    photoUrl: null,
    servings: 2,
    cuisine: "American",
    ingredients: ["200 g chicken breast", `${spinachGrams} g spinach`],
    steps: ["Cook."],
    prepMinutes: 10,
    cookMinutes: 20,
    totalMinutes: 30,
    activeMinutes: 30,
  };
}
const PAGES = [0, 100, 300, 600, 1000].map(page);

const PROFILE = {
  age: 25,
  sex: "male" as const,
  height_in: 70,
  weight_lb: 160,
  activity_level: "sedentary" as const,
  surplus_kcal: 300,
  min_ingredients: null,
  max_ingredients: null,
  weekly_budget_cents: null,
};
const DAILY_KCAL = targetsForProfile(PROFILE).kcal;

async function shortlist(capCents: number | null) {
  const db = fakeRecipeTables({
    seed: {
      profile: [{ ...PROFILE, max_cost_cents_per_meal: capCents }],
      foods: Object.values(FOODS),
    },
  });
  const week = await startWeek(db.client, {
    weekStart: "2026-11-08",
    cuisines: ["American"],
  });
  const result = await searchSlot({
    supabase: db.client,
    weekId: week.id,
    slot: "dinner",
    brave: { search: vi.fn(async () => PAGES.map((p) => p.url)) },
    readPage: async (url) => PAGES.find((p) => p.url === url) ?? null,
    lookup: async (name) => FOODS[name] ?? null,
    wait: async () => {},
  });
  return result.candidates.map((c) => ({
    title: c.recipe.title,
    cost: mealCostCents(
      {
        kcal: c.recipe.kcal,
        cost_cents_per_serving: c.recipe.costCentsPerServing,
      },
      "dinner",
      DAILY_KCAL,
    ),
    recipe: c.recipe,
  }));
}

describe("price limits", () => {
  it("prices every test meal", async () => {
    const all = await shortlist(null);
    expect(all).toHaveLength(PAGES.length);
    for (const c of all) expect(c.cost).not.toBeNull();
  });

  it("lists meals at or under the cap first, then every one over it, cheapest first", async () => {
    const uncapped = await shortlist(null);
    // At least one meal fits a cap at the cheapest shortlisted cost.
    const cap = Math.min(...uncapped.map((c) => c.cost!));
    const capped = await shortlist(cap);

    // Step 20e: every option is kept, over-cap ones after the ones that fit.
    expect(capped).toHaveLength(uncapped.length);
    const fits = capped.filter((c) => c.cost! <= cap);
    const over = capped.slice(fits.length);
    expect(fits.length).toBeGreaterThan(0);
    // Every meal that fits comes before every meal over the cap.
    expect(capped.slice(0, fits.length)).toEqual(fits);
    for (const c of over) {
      expect(c.cost!).toBeGreaterThan(cap);
      expect(
        costTag(
          {
            kcal: c.recipe.kcal,
            cost_cents_per_serving: c.recipe.costCentsPerServing,
          },
          "dinner",
          { cents: cap, dailyKcal: DAILY_KCAL },
        ),
      ).toMatch(/^\$\d+\.\d\d over$/);
    }
    // Over-cap meals come cheapest first.
    const overCosts = over.map((c) => c.cost!);
    expect(overCosts).toEqual([...overCosts].sort((a, b) => a - b));
  });

  it("keeps the normal ranking when everything fits", async () => {
    const uncapped = await shortlist(null);
    const capped = await shortlist(100_000);
    expect(capped.map((c) => c.title)).toEqual(uncapped.map((c) => c.title));
  });
});
