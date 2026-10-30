import { describe, expect, it, vi } from "vitest";
import search from "@/tests/fixtures/usda/big-mac-search.json";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";
import type { DishResult } from "@/lib/services/usda";
import { dishItem, pastItems, searchItems } from "./restaurantSearch";

const foods = search.foods as DishResult[];

function eatOut(
  id: number,
  restaurant: string | null,
  item: string,
  kcal: number,
) {
  return {
    id,
    date: "2026-11-02",
    slot: "dinner",
    kind: "restaurant",
    status: "confirmed",
    plan_item_id: null,
    portion: 0.5,
    restaurant_name: restaurant,
    item_name: item,
    kcal,
    protein_g: 30,
    carbs_g: 40,
    fat_g: 20,
  };
}

const food = (id: number) => foods.find((f) => f.fdcId === id)!;

describe("dishItem", () => {
  it("gives a chain item's numbers for one item", () => {
    // SR Legacy portions, as searchDishes adds them from the full record.
    const bigMac = {
      ...food(170720),
      foodMeasures: [{ disseminationText: "1 item", gramWeight: 219 }],
    };
    expect(dishItem(bigMac)).toEqual({
      source: "usda",
      key: "usda:170720",
      itemName: "McDONALD'S, BIG MAC",
      restaurantName: null,
      portion: "1 item (219 g)",
      kcal: 563,
      proteinG: 26,
      carbsG: 44,
      fatG: 33,
    });
  });

  it("prefers one whole item to a typical serving, and either to cups", () => {
    expect(dishItem(food(2705900))).toMatchObject({
      portion: "1 McDonald's Big Mac (205 g)",
      kcal: 535,
    });
    // A cup or a miniature burrito is about half of one.
    expect(dishItem(food(2706000))).toMatchObject({
      portion: "1 serving (220 g)",
      kcal: 537,
    });
    expect(
      dishItem({
        ...food(2706000),
        foodMeasures: [
          { disseminationText: "1 cup", gramWeight: 120 },
          { disseminationText: "1 miniature", gramWeight: 110 },
        ],
      })?.portion,
    ).toBe("1 cup (120 g)");
  });

  it("uses a branded serving and names the brand", () => {
    expect(dishItem(food(2001234))).toMatchObject({
      restaurantName: "McDonald's",
      portion: "2 Tbsp (30 g)",
      kcal: 150,
      fatG: 15,
    });
  });

  it("falls back to 100 g and drops foods without calories", () => {
    expect(dishItem(food(170720))?.portion).toBe("100 g");
    expect(dishItem(food(9999999))).toBeNull();
  });
});

describe("pastItems", () => {
  it("finds earlier eat-outs by restaurant or item, newest first, once each", async () => {
    const db = fakeRecipeTables({
      seed: {
        log_entries: [
          eatOut(1, "Torchy's Tacos", "Trailer Park taco", 570),
          eatOut(2, "Chuy's", "Chicken enchiladas", 900),
          eatOut(3, "Torchy's Tacos", "Trailer Park Taco", 600),
          eatOut(4, "Torchy's Tacos", "Queso", 280),
          { ...eatOut(5, null, "x", 1), kind: "planned", item_name: null },
        ],
      },
    });
    const found = await pastItems(db.client, "trailer taco");
    expect(found.map((f) => [f.itemName, f.kcal])).toEqual([
      ["Trailer Park Taco", 600],
    ]);
    // The whole item's numbers, whatever amount was eaten.
    expect(found[0]).toMatchObject({
      source: "past",
      restaurantName: "Torchy's Tacos",
      proteinG: 30,
    });
    expect(
      (await pastItems(db.client, "torch")).map((f) => f.itemName),
    ).toEqual(["Queso", "Trailer Park Taco"]);
  });
});

describe("searchItems", () => {
  it("puts past items before USDA results", async () => {
    const db = fakeRecipeTables({
      seed: { log_entries: [eatOut(1, "McDonald's", "Big Mac", 590)] },
    });
    const usda = { searchDishes: vi.fn().mockResolvedValue(foods) };
    const result = await searchItems(db.client, usda, "big mac");
    expect(usda.searchDishes).toHaveBeenCalledWith("big mac");
    expect(result.usdaError).toBeNull();
    // Past items, then foods named by every query word, then the rest.
    expect(result.items.map((i) => i.key)).toEqual([
      "past:1",
      "usda:170720",
      "usda:2705900",
      "usda:2001234",
      "usda:2706000",
    ]);
  });

  it("still returns past items when USDA fails", async () => {
    const db = fakeRecipeTables({
      seed: { log_entries: [eatOut(1, "McDonald's", "Big Mac", 590)] },
    });
    const usda = {
      searchDishes: vi.fn().mockRejectedValue(new Error("down")),
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await searchItems(db.client, usda, "big mac");
    expect(result.items).toHaveLength(1);
    expect(result.usdaError).toMatch(/USDA/);
  });
});
