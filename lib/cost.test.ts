import { describe, expect, it } from "vitest";
import { centsPerGramByFood, costPerServing } from "./cost";

describe("centsPerGramByFood", () => {
  it("keeps the cheapest price per gram for each food", () => {
    const perGram = centsPerGramByFood([
      { food_id: 1, package_grams: 454, price_cents: 499 },
      { food_id: 1, package_grams: 1361, price_cents: 1199 },
      { food_id: 2, package_grams: 0, price_cents: 100 },
    ]);
    expect(perGram.get(1)).toBeCloseTo(1199 / 1361);
    expect(perGram.has(2)).toBe(false);
  });
});

describe("costPerServing", () => {
  const perGram = new Map([
    [1, 1], // 1 cent per gram
    [2, 0.25],
  ]);

  it("sums each ingredient's share of its package price per serving", () => {
    // 300 g × 1¢ + 200 g × 0.25¢ = 350¢, over 4 servings = 87.5 → 88¢
    expect(
      costPerServing(
        [
          { food_id: 1, grams: 300 },
          { food_id: 2, grams: 200 },
          { food_id: null, grams: null }, // unparsed line
          { food_id: 2, grams: 0 }, // salt to taste
        ],
        perGram,
        4,
      ),
    ).toBe(88);
  });

  it("is unknown when a weighed ingredient has no price", () => {
    expect(
      costPerServing(
        [
          { food_id: 1, grams: 300 },
          { food_id: 3, grams: 50 },
        ],
        perGram,
        4,
      ),
    ).toBeNull();
  });

  it("is unknown when nothing could be priced or servings are missing", () => {
    expect(
      costPerServing([{ food_id: null, grams: null }], perGram, 4),
    ).toBeNull();
    expect(costPerServing([{ food_id: 1, grams: 100 }], perGram, 0)).toBeNull();
  });
});
