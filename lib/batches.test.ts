import { describe, expect, it } from "vitest";
import { BATCHES, buildBatch, formatAmount, scaleLine } from "./batches";

describe("formatAmount", () => {
  it("uses quarters under 10 and whole numbers above", () => {
    expect(formatAmount(2.25)).toBe("2¼");
    expect(formatAmount(0.5)).toBe("½");
    expect(formatAmount(3)).toBe("3");
    expect(formatAmount(2.4)).toBe("2½");
    expect(formatAmount(12.6)).toBe("13");
    expect(formatAmount(0.05)).toBe("0.05");
  });
});

describe("scaleLine", () => {
  it("multiplies the amount and keeps the rest", () => {
    expect(scaleLine("1 1/2 cups uncooked rice, rinsed", 1.5)).toBe(
      "2¼ cups uncooked rice, rinsed",
    );
    expect(scaleLine("2 tbsp olive oil", 3)).toBe("6 tbsp olive oil");
    expect(scaleLine("1 (15 oz) can black beans", 2)).toBe(
      "2 cans (15 oz) black beans",
    );
    expect(scaleLine("3-4 chicken thighs", 2)).toBe("6–8 chicken thighs");
    expect(scaleLine("500 g chicken breast", 1.75)).toBe(
      "875 g chicken breast",
    );
  });

  it("leaves lines without an amount as written", () => {
    expect(scaleLine("Salt to taste ", 3)).toBe("Salt to taste");
    expect(scaleLine("For the sauce:", 3)).toBe("For the sauce:");
  });
});

describe("buildBatch", () => {
  const recipe = {
    id: 7,
    title: "Fiesta Chicken",
    photoUrl: null,
    servings: 4,
    ingredients: [
      { text: "2 cups rice", grams: 370 },
      { text: "Salt to taste", grams: null },
    ],
    steps: ["Cook the rice."],
  };
  const items = [{ slot: "lunch" as const, servingsPerDay: 1.5, recipe }];

  it("makes servings per day × days of each recipe", () => {
    const [sunday, thursday] = BATCHES.map((b) =>
      buildBatch(b, "2026-11-01", items),
    );
    expect(sunday).toMatchObject({
      days: 4,
      from: "2026-11-01",
      to: "2026-11-04",
    });
    expect(thursday).toMatchObject({
      days: 3,
      from: "2026-11-05",
      to: "2026-11-07",
    });
    // Sunday: 1.5 × 4 = 6 servings of a 4-serving recipe, ×1.5.
    expect(sunday.recipes[0]).toMatchObject({
      servings: 6,
      factor: 1.5,
      ingredients: [
        { text: "3 cups rice", grams: 555 },
        { text: "Salt to taste", grams: null },
      ],
      steps: ["Cook the rice."],
    });
    // Thursday: 1.5 × 3 = 4.5 servings, ×1.125.
    expect(thursday.recipes[0]).toMatchObject({
      servings: 4.5,
      factor: 1.125,
      ingredients: [{ text: "2¼ cups rice", grams: 416 }, expect.anything()],
    });
  });
});
