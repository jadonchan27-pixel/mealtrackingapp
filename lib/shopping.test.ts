import { describe, expect, it } from "vitest";
import type { ShoppingListItemRow } from "@/lib/db/types";
import {
  buildShoppingList,
  groupShoppingList,
  packagesFor,
  type ShoppingFood,
  type ShoppingProduct,
} from "./shopping";

const FOODS: ShoppingFood[] = [
  { id: 1, name: "chicken breasts", section: "meat_seafood" },
  { id: 2, name: "green onions", section: "produce" },
  { id: 3, name: "scallions", section: "produce" },
  { id: 4, name: "salt", section: "spices_staples" },
  { id: 5, name: "water", section: "pantry" },
  { id: 6, name: "rice", section: "pantry" },
];

function product(
  id: number,
  foodId: number,
  name: string,
  packageGrams: number,
  priceCents: number,
  isEstimate = true,
): ShoppingProduct {
  return {
    id,
    food_id: foodId,
    name,
    package_grams: packageGrams,
    price_cents: priceCents,
    is_estimate: isEstimate,
  };
}

const PRODUCTS = [
  product(1, 1, "Chicken breasts, per lb", 454, 399),
  product(2, 2, "Green onions, bunch", 110, 79),
  product(3, 3, "Green onions, bunch", 110, 79),
  product(4, 4, "Iodized salt, 26 oz", 737, 99),
  product(5, 5, "Tap water", 1000, 0),
  product(6, 6, "Rice, 5 lb", 2270, 449),
  // A corrected rice price beats the estimate.
  product(7, 6, "H-E-B rice, 2 lb", 908, 199, false),
];

describe("packagesFor", () => {
  it("rounds up to whole packages, at least one", () => {
    expect(packagesFor(460, 454)).toBe(2);
    expect(packagesFor(908, 454)).toBe(2);
    expect(packagesFor(456, 454)).toBe(1); // within 1%, rounding in the grams
    expect(packagesFor(0, 454)).toBe(1);
  });
});

describe("buildShoppingList", () => {
  it("adds up every recipe across both batches", () => {
    const list = buildShoppingList(
      [
        {
          // 1.5 servings a day of a 4-serving recipe: 7 × 1.5 / 4 of it.
          servingsPerDay: 1.5,
          servings: 4,
          ingredients: [
            { foodId: 1, grams: 800 },
            { foodId: 2, grams: 30 },
            { foodId: 4, grams: null }, // salt to taste
            { foodId: 5, grams: 500 }, // water
            { foodId: null, grams: null }, // unparsed line
          ],
        },
        {
          servingsPerDay: 1,
          servings: 2,
          ingredients: [
            { foodId: 1, grams: 200 },
            { foodId: 3, grams: 20 },
            { foodId: 6, grams: 300 },
          ],
        },
      ],
      FOODS,
      PRODUCTS,
    );

    const chicken = list.find((l) => l.foodId === 1)!;
    // 800 × 7 × 1.5 / 4 + 200 × 7 / 2 = 2100 + 700
    expect(chicken).toMatchObject({
      name: "Chicken breasts, per lb",
      section: "meat_seafood",
      neededGrams: 2800,
      packages: 7,
      priceCents: 7 * 399,
      batch: "both",
    });

    // Green onions and scallions are one product: 78.75 g + 70 g.
    const onions = list.filter((l) => l.name === "Green onions, bunch");
    expect(onions).toHaveLength(1);
    expect(onions[0]).toMatchObject({
      neededGrams: 149,
      packages: 2,
      priceCents: 158,
    });

    // Salt with no amount is one package; water isn't bought.
    expect(list.find((l) => l.foodId === 4)).toMatchObject({
      neededGrams: 0,
      packages: 1,
      priceCents: 99,
    });
    expect(list.some((l) => l.foodId === 5)).toBe(false);

    // The corrected rice product is used: 1050 g in 908 g bags.
    expect(list.find((l) => l.foodId === 6)).toMatchObject({
      hebProductId: 7,
      name: "H-E-B rice, 2 lb",
      packages: 2,
      priceCents: 398,
    });
    expect(list).toHaveLength(4);
  });

  it("skips foods with no product and recipes with no servings", () => {
    expect(
      buildShoppingList(
        [
          {
            servingsPerDay: 1,
            servings: 2,
            ingredients: [{ foodId: 99, grams: 100 }],
          },
          {
            servingsPerDay: 1,
            servings: 0,
            ingredients: [{ foodId: 1, grams: 100 }],
          },
        ],
        FOODS,
        PRODUCTS,
      ),
    ).toEqual([]);
  });
});

describe("groupShoppingList", () => {
  function row(
    id: number,
    name: string,
    section: ShoppingListItemRow["section"],
    priceCents: number,
  ): ShoppingListItemRow {
    return {
      id,
      user_id: "u1",
      week_plan_id: 1,
      food_id: id,
      heb_product_id: id,
      name,
      section,
      needed_grams: 100,
      packages: 1,
      price_cents: priceCents,
      batch: "both",
      checked: false,
      created_at: "",
      updated_at: "",
    };
  }

  it("groups by section in store order, A to Z, with the total", () => {
    const list = groupShoppingList([
      row(1, "Salt", "spices_staples", 99),
      row(2, "Limes", "produce", 25),
      row(3, "Chicken", "meat_seafood", 399),
      row(4, "Cilantro", "produce", 59),
    ]);
    expect(
      list.sections.map((s) => [s.label, s.items.map((i) => i.name)]),
    ).toEqual([
      ["Produce", ["Cilantro", "Limes"]],
      ["Meat and seafood", ["Chicken"]],
      ["Spices, oils and sauces", ["Salt"]],
    ]);
    expect(list.totalCents).toBe(582);
  });
});
