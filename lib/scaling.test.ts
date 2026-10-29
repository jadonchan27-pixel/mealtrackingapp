import { describe, expect, it } from "vitest";
import type { MealSlot } from "@/lib/db/types";
import {
  dailyTotals,
  KCAL_TOLERANCE,
  scalePortions,
  type ScalableRecipe,
} from "./scaling";

function recipe(
  slot: MealSlot,
  recipeId: number,
  kcal: number,
  proteinG: number,
): ScalableRecipe {
  return { slot, recipeId, kcal, proteinG, carbsG: 30, fatG: 10 };
}

const WEEK = [
  recipe("breakfast", 1, 420, 25),
  recipe("lunch", 2, 560, 40),
  recipe("dinner", 3, 650, 45),
  recipe("snack", 4, 210, 15),
];

describe("scalePortions", () => {
  it("splits the day 80/20 and lands within 5% of the calorie target", () => {
    const targets = { kcal: 2900, proteinG: 150 };
    const items = scalePortions(WEEK, targets);
    const totals = dailyTotals(items);
    expect(Math.abs(totals.kcal - targets.kcal) / targets.kcal).toBeLessThan(
      KCAL_TOLERANCE,
    );
    // Snack: 20% of 2900 = 580 kcal → 2 servings of 210 (the most allowed).
    expect(items.find((i) => i.slot === "snack")!.servingsPerDay).toBe(2);
    // Every serving count is a whole quarter.
    for (const i of items) {
      expect(i.servingsPerDay * 4).toBe(Math.round(i.servingsPerDay * 4));
    }
    // Meals get about the same calories each.
    const mealKcal = items
      .filter((i) => i.slot !== "snack")
      .map((i) => i.kcal * i.servingsPerDay);
    expect(Math.max(...mealKcal) - Math.min(...mealKcal)).toBeLessThan(300);
  });

  it("keeps the slot order", () => {
    const items = scalePortions(WEEK, { kcal: 2500, proteinG: 120 });
    expect(items.map((i) => i.slot)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ]);
  });

  it("gives the snack 1 serving when that's nearer its share", () => {
    const items = scalePortions(
      [...WEEK.slice(0, 3), recipe("snack", 4, 450, 20)],
      { kcal: 2600, proteinG: 100 },
    );
    expect(items[3].servingsPerDay).toBe(1);
  });

  it("tops up protein on the highest-protein meal, within 5% of calories", () => {
    const targets = { kcal: 2600, proteinG: 200 };
    const plain = scalePortions(WEEK, { ...targets, proteinG: 0 });
    const topped = scalePortions(WEEK, targets);
    const dinner = (items: typeof plain) =>
      items.find((i) => i.slot === "dinner")!.servingsPerDay;
    const extra = dinner(topped) - dinner(plain);
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeLessThanOrEqual(0.5);
    expect(dailyTotals(topped).kcal).toBeLessThanOrEqual(
      targets.kcal * (1 + KCAL_TOLERANCE),
    );
  });

  it("doesn't top up when protein is already met", () => {
    const low = scalePortions(WEEK, { kcal: 2400, proteinG: 0 });
    const met = scalePortions(WEEK, { kcal: 2400, proteinG: 50 });
    expect(met).toEqual(low);
  });

  it("stays within 5% across many targets and recipe sizes", () => {
    for (let kcal = 1800; kcal <= 3600; kcal += 150) {
      for (const size of [250, 480, 720]) {
        const items = scalePortions(
          [
            recipe("breakfast", 1, size, 20),
            recipe("lunch", 2, size + 90, 30),
            recipe("dinner", 3, size + 180, 35),
            recipe("snack", 4, 200, 10),
          ],
          { kcal, proteinG: 0 },
        );
        const off = Math.abs(dailyTotals(items).kcal - kcal) / kcal;
        expect(off, `${kcal} kcal, ${size} kcal recipes`).toBeLessThan(
          KCAL_TOLERANCE,
        );
      }
    }
  });

  it("refuses a recipe with no calories", () => {
    expect(() =>
      scalePortions([recipe("lunch", 1, 0, 0)], { kcal: 2000, proteinG: 0 }),
    ).toThrow(/no calories/);
  });

  // US-33: breakfast, and one dish eaten for lunch and dinner.
  it("scales a dish eaten twice a day to two meals' worth", () => {
    const targets = { kcal: 2700, proteinG: 120 };
    const [breakfast, shared] = scalePortions(
      [
        recipe("breakfast", 1, 450, 25),
        { ...recipe("lunch", 2, 600, 40), meals: 2 },
      ],
      targets,
    );
    const totals = dailyTotals([breakfast, shared]);
    expect(Math.abs(totals.kcal - targets.kcal) / targets.kcal).toBeLessThan(
      KCAL_TOLERANCE,
    );
    // Each of the three meals gets about 900 kcal: 2 servings of breakfast,
    // 1.5 servings at lunch and again at dinner.
    expect(breakfast.servingsPerDay).toBe(2);
    expect(shared.servingsPerDay).toBe(3);
    // Each meal's half is still a whole quarter serving.
    expect((shared.servingsPerDay / 2) * 4).toBe(
      Math.round((shared.servingsPerDay / 2) * 4),
    );
  });

  it("tops up the shared dish's protein by at most half a serving a day", () => {
    const recipes = [
      recipe("breakfast", 1, 500, 5),
      { ...recipe("lunch", 2, 100, 60), meals: 2 },
    ];
    const plain = scalePortions(
      recipes.map((r) => ({ ...r, proteinG: 0 })),
      { kcal: 3000, proteinG: 0 },
    );
    const topped = scalePortions(recipes, { kcal: 3000, proteinG: 4000 });
    expect(topped[1].servingsPerDay - plain[1].servingsPerDay).toBe(0.5);
  });
});
