import { describe, expect, it } from "vitest";
import {
  parseIngredient,
  type ParsedIngredient,
} from "@/lib/ingredients/parse";
import {
  ingredientAmount,
  ingredientGrams,
  lookupName,
  recipeNutrition,
  roundNutrients,
  type FoodNutrition,
} from "./nutrition";

function parsed(line: string): ParsedIngredient {
  const r = parseIngredient(line);
  if (r.status !== "parsed") throw new Error(`didn't parse: ${line}`);
  return r;
}

const food = (
  grams_per_unit: Record<string, number>,
  kcal = 100,
): FoodNutrition => ({
  kcal_100g: kcal,
  protein_100g: 10,
  carbs_100g: 20,
  fat_100g: 5,
  fiber_100g: 1,
  sugar_100g: 2,
  sodium_mg_100g: 50,
  grams_per_unit,
});

describe("ingredientAmount", () => {
  it("uses the midpoint of a range", () => {
    expect(ingredientAmount(parsed("3-4 chicken thighs"))).toBe(3.5);
    expect(ingredientAmount(parsed("2 eggs"))).toBe(2);
    expect(ingredientAmount(parsed("salt to taste"))).toBeNull();
  });
});

describe("ingredientGrams", () => {
  it("converts mass units directly", () => {
    expect(ingredientGrams(parsed("8 oz cheese"), food({}))).toBeCloseTo(
      226.8,
      1,
    );
    expect(ingredientGrams(parsed("1.5 lb beef"), food({}))).toBeCloseTo(
      680.4,
      1,
    );
    expect(ingredientGrams(parsed("400g pasta"), food({}))).toBe(400);
  });

  it("uses the food's weight for a volume unit", () => {
    expect(ingredientGrams(parsed("2 cups rice"), food({ cup: 158 }))).toBe(
      316,
    );
  });

  it("works out other volumes from the food's density", () => {
    // 158 g per cup → 1 tbsp is 1/16 cup
    expect(
      ingredientGrams(parsed("2 tbsp rice"), food({ cup: 158 })),
    ).toBeCloseTo(19.75, 2);
    expect(
      ingredientGrams(parsed("100 ml rice"), food({ cup: 158 })),
    ).toBeCloseTo(66.78, 2);
  });

  it("uses count units the food knows", () => {
    expect(
      ingredientGrams(parsed("2 slices cheddar"), food({ slice: 28 })),
    ).toBe(56);
    expect(
      ingredientGrams(parsed("1 stick butter"), food({ stick: 113 })),
    ).toBe(113);
  });

  it("uses the size word for whole items, then a default size", () => {
    const egg = food({ large: 50, medium: 44, small: 38 });
    expect(ingredientGrams(parsed("2 large eggs"), egg)).toBe(100);
    expect(ingredientGrams(parsed("2 small eggs"), egg)).toBe(76);
    expect(ingredientGrams(parsed("2 eggs"), egg)).toBe(88);
    expect(ingredientGrams(parsed("1 onion"), food({ each: 110 }))).toBe(110);
  });

  it("uses a package size", () => {
    expect(
      ingredientGrams(parsed("1 (14.5 oz) can diced tomatoes"), food({})),
    ).toBeCloseTo(411.07, 2);
    expect(ingredientGrams(parsed("2 x 400g tins tomatoes"), food({}))).toBe(
      800,
    );
  });

  it("counts unmeasured lines as nothing", () => {
    expect(ingredientGrams(parsed("salt to taste"), food({}))).toBe(0);
  });

  it("returns null when the weight is unknown", () => {
    expect(ingredientGrams(parsed("2 cups spinach"), food({}))).toBeNull();
    expect(
      ingredientGrams(parsed("3 cloves garlic"), food({ cup: 136 })),
    ).toBeNull();
    expect(ingredientGrams(parsed("2 eggs"), food({ cup: 243 }))).toBeNull();
  });

  it("ignores bad grams_per_unit values", () => {
    expect(
      ingredientGrams(parsed("2 eggs"), { grams_per_unit: { each: "50" } }),
    ).toBeNull();
    expect(
      ingredientGrams(parsed("2 eggs"), { grams_per_unit: [] }),
    ).toBeNull();
  });
});

describe("recipeNutrition", () => {
  it("sums nutrition and divides by servings", () => {
    const result = recipeNutrition(
      [
        { ingredient: parseIngredient("200 g rice"), food: food({}, 130) },
        { ingredient: parseIngredient("100 g beans"), food: food({}, 90) },
      ],
      2,
    );
    expect(result.total).toEqual({
      kcal: 350,
      proteinG: 30,
      carbsG: 60,
      fatG: 15,
      fiberG: 3,
      sugarG: 6,
      sodiumMg: 150,
    });
    expect(result.perServing.kcal).toBe(175);
    expect(result.missing).toEqual([]);
  });

  it("lists lines it couldn't count", () => {
    const result = recipeNutrition(
      [
        { ingredient: parseIngredient("For the sauce:"), food: null },
        { ingredient: parseIngredient("3 cups"), food: null },
        { ingredient: parseIngredient("1 cup mystery"), food: null },
        {
          ingredient: parseIngredient("1 cup unmatched"),
          food: { ...food({ cup: 100 }), kcal_100g: null },
        },
        { ingredient: parseIngredient("2 cloves garlic"), food: food({}) },
        { ingredient: parseIngredient("Salt to taste"), food: null },
      ],
      1,
    );
    expect(result.missing).toEqual([
      { raw: "3 cups", reason: "unparsed" },
      { raw: "1 cup mystery", reason: "no food match" },
      { raw: "1 cup unmatched", reason: "no food match" },
      { raw: "2 cloves garlic", reason: "unknown weight" },
    ]);
    expect(result.total.kcal).toBe(0);
  });

  it("treats missing nutrient values as zero", () => {
    const result = recipeNutrition(
      [
        {
          ingredient: parseIngredient("100 g rice"),
          food: { ...food({}), fiber_100g: null },
        },
      ],
      1,
    );
    expect(result.total.fiberG).toBe(0);
  });

  it("needs a positive number of servings", () => {
    expect(() => recipeNutrition([], 0)).toThrow();
  });
});

describe("lookupName", () => {
  it("looks a canned food up as canned", () => {
    expect(lookupName(parsed("1 (15 oz) can black beans, drained"))).toBe(
      "canned black beans",
    );
    expect(lookupName(parsed("2 x 400g tins chopped tomatoes"))).toBe(
      "canned chopped tomatoes",
    );
  });

  it("leaves other foods and already-canned ones alone", () => {
    expect(lookupName(parsed("1 cup black beans"))).toBe("black beans");
    expect(lookupName(parsed("1 can canned corn"))).toBe("canned corn");
  });
});

describe("roundNutrients", () => {
  it("rounds kcal and mg to whole numbers and grams to one decimal", () => {
    expect(
      roundNutrients({
        kcal: 513.15,
        proteinG: 23.9048,
        carbsG: 45.64,
        fatG: 25.06,
        fiberG: 0,
        sugarG: 0.55,
        sodiumMg: 364.7,
      }),
    ).toEqual({
      kcal: 513,
      proteinG: 23.9,
      carbsG: 45.6,
      fatG: 25.1,
      fiberG: 0,
      sugarG: 0.6,
      sodiumMg: 365,
    });
  });
});
