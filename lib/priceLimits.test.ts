import { describe, expect, it } from "vitest";
import type { ShoppingList } from "@/lib/shopping";
import {
  applyCostCap,
  budgetStatus,
  costTag,
  mealCostCents,
  mealServings,
} from "./priceLimits";

describe("mealServings", () => {
  it("sizes a meal to its share of 80% of the day", () => {
    // 2400 kcal × 0.8 ÷ 3 = 640 kcal a meal.
    expect(mealServings("dinner", 320, 2400)).toBe(2);
    expect(mealServings("lunch", 430, 2400)).toBe(1.5);
    expect(mealServings("breakfast", 5000, 2400)).toBe(0.25);
  });

  it("gives the snack 1 or 2 servings", () => {
    // 20% of 2400 = 480 kcal.
    expect(mealServings("snack", 400, 2400)).toBe(1);
    expect(mealServings("snack", 200, 2400)).toBe(2);
  });

  it("counts unknown calories as one serving", () => {
    expect(mealServings("dinner", null, 2400)).toBe(1);
    expect(mealServings("dinner", 0, 2400)).toBe(1);
  });
});

describe("mealCostCents", () => {
  it("prices the meal at its portion", () => {
    expect(
      mealCostCents({ kcal: 320, cost_cents_per_serving: 150 }, "dinner", 2400),
    ).toBe(300);
    expect(
      mealCostCents(
        { kcal: 320, cost_cents_per_serving: null },
        "dinner",
        2400,
      ),
    ).toBeNull();
  });
});

describe("applyCostCap", () => {
  const r = (id: number, kcal: number, cost: number | null) => ({
    id,
    recipe: { kcal, cost_cents_per_serving: cost },
  });
  const cap = { cents: 400, dailyKcal: 2400 };

  it("keeps fitting and unpriced recipes in rank order", () => {
    const ranked = [
      r(1, 640, 300),
      r(2, 640, 500),
      r(3, 640, null),
      r(4, 640, 100),
    ];
    expect(applyCostCap(ranked, "dinner", cap, 3).map((x) => x.id)).toEqual([
      1, 3, 4,
    ]);
  });

  it("fills a short list with the cheapest over-cap meals", () => {
    const ranked = [
      r(1, 640, 900),
      r(2, 640, 300),
      r(3, 640, 600),
      r(4, 640, 700),
    ];
    expect(applyCostCap(ranked, "dinner", cap, 3).map((x) => x.id)).toEqual([
      2, 3, 4,
    ]);
  });

  it("caps the portion's cost, not one serving's", () => {
    // $2.50 a serving, but 2 servings make a $5 meal.
    expect(
      applyCostCap([r(1, 320, 250), r(2, 640, 350)], "dinner", cap, 1).map(
        (x) => x.id,
      ),
    ).toEqual([2]);
  });
});

describe("costTag", () => {
  const cap = { cents: 400, dailyKcal: 2400 };
  it("marks unknown and over-cap meals", () => {
    expect(
      costTag({ kcal: 640, cost_cents_per_serving: null }, "dinner", cap),
    ).toBe("price unknown");
    expect(
      costTag({ kcal: 640, cost_cents_per_serving: 520 }, "dinner", cap),
    ).toBe("$1.20 over");
    expect(
      costTag({ kcal: 640, cost_cents_per_serving: 400 }, "dinner", cap),
    ).toBeNull();
  });
});

describe("budgetStatus", () => {
  const item = (name: string, priceCents: number, estimate = true) => ({
    id: 1,
    name,
    neededGrams: 100,
    packages: 1,
    priceCents,
    batch: "both" as const,
    checked: false,
    estimate,
  });
  const list: ShoppingList = {
    sections: [
      {
        section: "produce",
        label: "Produce",
        items: [
          item("Yellow onions, 3 lb", 300),
          item("Sumac (estimated)", 450),
          item("Limes", 200, false),
        ],
      },
    ],
    totalCents: 950,
  };

  it("compares the total with the budget and counts rough guesses", () => {
    expect(budgetStatus(list, 8000)).toEqual({
      totalCents: 950,
      budgetCents: 8000,
      over: false,
      unpriced: 1,
    });
    expect(budgetStatus(list, 900).over).toBe(true);
  });
});
