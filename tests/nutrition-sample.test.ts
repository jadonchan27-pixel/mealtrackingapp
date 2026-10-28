// Build step 9 "done when": a sample recipe's nutrition is computed (USDA mocked)
// and cached foods are reused.

import { describe, expect, it, vi } from "vitest";
import butter from "@/tests/fixtures/usda/butter-sr-legacy.json";
import cheddar from "@/tests/fixtures/usda/cheddar-sr-legacy.json";
import egg from "@/tests/fixtures/usda/egg-sr-legacy.json";
import rice from "@/tests/fixtures/usda/rice-foundation.json";
import { fakeFoodsTable } from "@/tests/helpers/fakeFoodsTable";
import { createFoodLookup } from "@/lib/foods";
import { nutritionForRecipe } from "@/lib/nutrition";
import { toUsdaFood, type FoodDetails } from "@/lib/services/usda";

const USDA: Record<string, FoodDetails> = {
  "large eggs": egg,
  "cooked white rice": rice,
  "salted butter": butter,
  "shredded cheddar cheese": cheddar,
};

const RECIPE = [
  "4 large eggs",
  "2 cups cooked white rice",
  "1 tbsp salted butter",
  "1/2 cup shredded cheddar cheese",
  "Salt and pepper to taste",
];

function fakeUsda() {
  return {
    findFood: vi.fn(async (query: string) =>
      USDA[query] ? toUsdaFood(USDA[query]) : null,
    ),
  };
}

describe("sample recipe: cheesy egg rice bowl, 2 servings", () => {
  it("computes nutrition per serving", async () => {
    const lookup = createFoodLookup({
      supabase: fakeFoodsTable().client,
      usda: fakeUsda(),
    });

    const result = await nutritionForRecipe(RECIPE, 2, lookup);

    // eggs 200 g + rice 316 g + butter 14.2 g + cheddar 56.5 g
    // kcal: 286 + 410.8 + 101.8 + 227.7 = 1026.3 → 513.2 per serving
    expect(result.total.kcal).toBe(1026);
    expect(result.perServing).toEqual({
      kcal: 513,
      proteinG: 23.9,
      carbsG: 45.6,
      fatG: 25.1,
      fiberG: 0,
      sugarG: 0.5,
      sodiumMg: 365,
    });
    expect(result.missing).toEqual([]);
  });

  it("reuses cached foods on the next run", async () => {
    const table = fakeFoodsTable();
    const usda = fakeUsda();

    await nutritionForRecipe(
      RECIPE,
      2,
      createFoodLookup({ supabase: table.client, usda }),
    );
    expect(usda.findFood).toHaveBeenCalledTimes(4); // salt to taste isn't looked up

    const again = await nutritionForRecipe(
      RECIPE,
      2,
      createFoodLookup({ supabase: table.client, usda }),
    );
    expect(usda.findFood).toHaveBeenCalledTimes(4);
    expect(again.perServing.kcal).toBe(513);
  });
});
