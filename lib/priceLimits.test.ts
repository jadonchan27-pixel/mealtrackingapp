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
  it("sizes a meal to a third of the day", () => {
    // US-33: 2400 kcal ÷ 3 = 800 kcal a meal.
    expect(mealServings("dinner", 400, 2400)).toBe(2);
    expect(mealServings("lunch", 530, 2400)).toBe(1.5);
    expect(mealServings("breakfast", 5000, 2400)).toBe(0.25);
  });

  it("gives an older week's snack 1 or 2 servings", () => {
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
      mealCostCents({ kcal: 400, cost_cents_per_serving: 150 }, "dinner", 2400),
    ).toBe(300);
    expect(
      mealCostCents(
        { kcal: 400, cost_cents_per_serving: null },
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
      r(1, 800, 300),
      r(2, 800, 500),
      r(3, 800, null),
      r(4, 800, 100),
    ];
    expect(applyCostCap(ranked, "dinner", cap, 3).map((x) => x.id)).toEqual([
      1, 3, 4,
    ]);
  });

  it("fills a short list with the cheapest over-cap meals", () => {
    const ranked = [
      r(1, 800, 900),
      r(2, 800, 300),
      r(3, 800, 600),
      r(4, 800, 700),
    ];
    expect(applyCostCap(ranked, "dinner", cap, 3).map((x) => x.id)).toEqual([
      2, 3, 4,
    ]);
  });

  it("keeps every fitting recipe but only fills up to `fill`", () => {
    const ranked = [
      r(1, 800, 900),
      r(2, 800, 300),
      r(3, 800, 600),
      r(4, 800, 700),
      r(5, 800, 100),
    ];
    // 2 fit; over-cap ones top up to 3.
    expect(
      applyCostCap(ranked, "dinner", cap, Infinity, 3).map((x) => x.id),
    ).toEqual([2, 5, 3]);
    const cheap = [
      r(1, 800, 100),
      r(2, 800, 200),
      r(3, 800, 300),
      r(4, 800, 350),
      r(5, 800, 900),
    ];
    expect(
      applyCostCap(cheap, "dinner", cap, Infinity, 3).map((x) => x.id),
    ).toEqual([1, 2, 3, 4]);
  });

  it("caps the portion's cost, not one serving's", () => {
    // $2.50 a serving, but 2 servings make a $5 meal.
    expect(
      applyCostCap([r(1, 400, 250), r(2, 800, 350)], "dinner", cap, 1).map(
        (x) => x.id,
      ),
    ).toEqual([2]);
  });
});

describe("costTag", () => {
  const cap = { cents: 400, dailyKcal: 2400 };
  it("marks unknown and over-cap meals", () => {
    expect(
      costTag({ kcal: 800, cost_cents_per_serving: null }, "dinner", cap),
    ).toBe("price unknown");
    expect(
      costTag({ kcal: 800, cost_cents_per_serving: 520 }, "dinner", cap),
    ).toBe("$1.20 over");
    expect(
      costTag({ kcal: 800, cost_cents_per_serving: 400 }, "dinner", cap),
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
