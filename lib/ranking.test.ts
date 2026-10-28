import { describe, expect, it } from "vitest";
import {
  cuisineScore,
  isEligible,
  MAX_ACTIVE_MINUTES,
  proteinPer100Kcal,
  rankRecipes,
  type RankableRecipe,
} from "./ranking";

let nextId = 1;
function recipe(fields: Partial<RankableRecipe> = {}): RankableRecipe {
  return {
    id: nextId++,
    title: "Recipe",
    cuisine: null,
    active_minutes: 30,
    kcal: 500,
    protein_g: 30,
    cost_cents_per_serving: null,
    ...fields,
  };
}

describe("isEligible", () => {
  it("keeps recipes with known active time up to an hour", () => {
    expect(isEligible(recipe({ active_minutes: MAX_ACTIVE_MINUTES }))).toBe(
      true,
    );
    expect(isEligible(recipe({ active_minutes: 61 }))).toBe(false);
    expect(isEligible(recipe({ active_minutes: null }))).toBe(false);
  });

  it("drops recipes without nutrition", () => {
    expect(isEligible(recipe({ kcal: null }))).toBe(false);
    expect(isEligible(recipe({ kcal: 0 }))).toBe(false);
  });

  it("drops last week's recipes", () => {
    const r = recipe();
    expect(isEligible(r, new Set([r.id]))).toBe(false);
  });
});

describe("cuisineScore", () => {
  it("matches chosen cuisines regardless of case and punctuation", () => {
    expect(cuisineScore("Indian", ["indian"])).toBe(1);
    expect(cuisineScore("Tex-Mex", ["tex mex", "thai"])).toBe(1);
    expect(cuisineScore("South Indian", ["Indian"])).toBe(1);
  });

  it("scores other cuisines 0 and unknown ones in between", () => {
    expect(cuisineScore("Italian", ["Indian"])).toBe(0);
    expect(cuisineScore(null, ["Indian"])).toBe(0.5);
    expect(cuisineScore("", ["Indian"])).toBe(0.5);
  });

  it("treats every recipe as a match when no cuisine is chosen", () => {
    expect(cuisineScore("Italian", [])).toBe(1);
    expect(cuisineScore(null, [])).toBe(1);
  });
});

describe("proteinPer100Kcal", () => {
  it("is grams of protein per 100 kcal", () => {
    expect(proteinPer100Kcal(recipe({ kcal: 400, protein_g: 40 }))).toBe(10);
    expect(proteinPer100Kcal(recipe({ protein_g: null }))).toBe(0);
  });
});

describe("rankRecipes", () => {
  it("prefers the chosen cuisine, then protein density, then low cost", () => {
    const italian = recipe({
      title: "Italian",
      cuisine: "Italian",
      protein_g: 60,
    });
    const lean = recipe({
      title: "Lean",
      cuisine: "Indian",
      protein_g: 50,
      cost_cents_per_serving: 300,
    });
    const cheap = recipe({
      title: "Cheap",
      cuisine: "Indian",
      protein_g: 20,
      cost_cents_per_serving: 150,
    });
    const unknown = recipe({ title: "Unknown", cuisine: null, protein_g: 40 });

    const ranked = rankRecipes([italian, lean, cheap, unknown], {
      cuisines: ["Indian"],
    });

    // Protein per 100 kcal: Italian 12, Lean 10, Unknown 8, Cheap 4.
    // Lean:    0.4 × 1   + 0.35 × 0.75 + 0.25 × 0   = 0.6625
    // Unknown: 0.4 × 0.5 + 0.35 × 0.5  + 0.25 × 0.5 = 0.5
    // Cheap:   0.4 × 1   + 0.35 × 0    + 0.25 × 1   = 0.65
    // Italian: 0.4 × 0   + 0.35 × 1    + 0.25 × 0.5 = 0.475
    expect(ranked.map((r) => [r.recipe.title, r.score])).toEqual([
      ["Lean", 0.663],
      ["Cheap", 0.65],
      ["Unknown", 0.5],
    ]);
  });

  it("filters before ranking and returns the top 3 by default", () => {
    const slow = recipe({ active_minutes: 90, protein_g: 100 });
    const lastWeek = recipe({ protein_g: 90 });
    const rest = [10, 20, 30, 40].map((p) => recipe({ protein_g: p }));

    const ranked = rankRecipes([slow, lastWeek, ...rest], {
      excludedIds: new Set([lastWeek.id]),
    });

    expect(ranked.map((r) => r.recipe.protein_g)).toEqual([40, 30, 20]);
  });

  it("scores tied costs and proteins in full", () => {
    const [a, b] = [
      recipe({ cost_cents_per_serving: 200 }),
      recipe({ cost_cents_per_serving: 200 }),
    ];
    expect(rankRecipes([a, b]).map((r) => r.score)).toEqual([1, 1]);
  });

  it("returns nothing when no recipe is eligible", () => {
    expect(rankRecipes([recipe({ active_minutes: null })])).toEqual([]);
    expect(rankRecipes([])).toEqual([]);
  });
});
