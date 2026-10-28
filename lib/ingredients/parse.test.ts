import { describe, expect, it } from "vitest";
import { normalizeUnit, parseIngredient, parseIngredients } from "./parse";

function parsed(line: string) {
  const result = parseIngredient(line);
  if (result.status !== "parsed") {
    throw new Error(`expected "${line}" to parse, got: ${result.reason}`);
  }
  return result;
}

describe("quantities", () => {
  it.each([
    ["2 cups flour", 2],
    ["1.5 cups flour", 1.5],
    [".5 cup flour", 0.5],
    ["1/2 cup flour", 0.5],
    ["1 1/2 cups flour", 1.5],
    ["½ cup flour", 0.5],
    ["1½ cups flour", 1.5],
    ["1 ½ cups flour", 1.5],
    ["1⁄2 cup flour", 0.5],
    ["one cup flour", 1],
    ["a cup of flour", 1],
    ["half a cup flour", 0.5],
  ])("%s → %d", (line, quantity) => {
    expect(parsed(line).quantity).toBe(quantity);
  });

  it("rounds repeating fractions to 3 places", () => {
    expect(parsed("1/3 cup oil").quantity).toBe(0.333);
  });

  it.each([
    ["3-4 chicken thighs", 3, 4],
    ["3 - 4 chicken thighs", 3, 4],
    ["3–4 chicken thighs", 3, 4],
    ["3 to 4 chicken thighs", 3, 4],
    ["1 or 2 chicken thighs", 1, 2],
    ["1 1/2-2 cups broth", 1.5, 2],
  ])("reads a range: %s", (line, low, high) => {
    const r = parsed(line);
    expect([r.quantity, r.quantityMax]).toEqual([low, high]);
  });

  it("leaves quantityMax null without a range", () => {
    expect(parsed("2 cups flour").quantityMax).toBeNull();
  });
});

describe("units", () => {
  it.each([
    ["1 teaspoon salt", "tsp"],
    ["1 tsp. salt", "tsp"],
    ["1 t salt", "tsp"],
    ["1 Tablespoon oil", "tbsp"],
    ["1 Tbsp oil", "tbsp"],
    ["1 T oil", "tbsp"],
    ["1 c. milk", "cup"],
    ["8 fl oz cream", "fl_oz"],
    ["8 fluid ounces cream", "fl_oz"],
    ["8 ounces cheese", "oz"],
    ["2 lbs chicken", "lb"],
    ["500 grams rice", "g"],
    ["500g rice", "g"],
    ["1 kg potatoes", "kg"],
    ["250 ml stock", "ml"],
    ["1 litre stock", "l"],
    ["1 quart stock", "quart"],
    ["3 cloves garlic", "clove"],
    ["2 tins tomatoes", "can"],
    ["2 ribs celery", "stalk"],
  ])("%s → %s", (line, unit) => {
    expect(parsed(line).unit).toBe(unit);
  });

  it("doesn't mistake the start of a food for a unit", () => {
    expect(parsed("1 carrot").unit).toBeNull();
    expect(parsed("2 large eggs").unit).toBeNull();
    expect(parsed("1 tomato").unit).toBeNull();
    expect(parsed("2 gala apples").unit).toBeNull();
    expect(parsed("Canola oil").unit).toBeNull();
  });

  it("adds a 'plus' amount in the same kind of unit", () => {
    expect(parsed("1 cup plus 2 tablespoons milk")).toMatchObject({
      quantity: 1.125,
      unit: "cup",
      food: "milk",
    });
  });

  it("keeps a 'plus' amount it can't add as a note", () => {
    expect(parsed("1 cup plus 2 oz cheese")).toMatchObject({
      quantity: 1,
      unit: "cup",
      food: "cheese",
      note: "plus 2 oz",
    });
  });
});

describe("food and notes", () => {
  it("splits off prep after a comma", () => {
    expect(parsed("1 onion, finely chopped")).toMatchObject({
      food: "onion",
      note: "finely chopped",
    });
  });

  it("moves parentheses and amount phrases to the note", () => {
    expect(parsed("Salt (optional)")).toMatchObject({
      food: "Salt",
      note: "optional",
    });
    expect(parsed("Black pepper to taste")).toMatchObject({
      quantity: null,
      food: "Black pepper",
      note: "to taste",
    });
  });

  it("keeps the original line", () => {
    expect(parsed("  2 eggs ").raw).toBe("  2 eggs ");
  });

  it("parses a list", () => {
    expect(parseIngredients(["1 egg", ""]).map((r) => r.status)).toEqual([
      "parsed",
      "unparsed",
    ]);
  });
});

describe("unparsed lines", () => {
  it.each([
    ["", "empty line"],
    ["   ", "empty line"],
    ["For the marinade:", "section heading"],
    ["2 cups", "no food name"],
    ["1/2", "no food name"],
    ["---", "no food name"],
  ])("%o → %s", (line, reason) => {
    expect(parseIngredient(line)).toEqual({
      status: "unparsed",
      raw: line,
      reason,
    });
  });
});

describe("normalizeUnit", () => {
  it.each([
    ["cups", "cup"],
    ["Tbsp.", "tbsp"],
    ["tablespoon", "tbsp"],
    ["T", "tbsp"],
    ["t", "tsp"],
    ["fl oz", "fl_oz"],
    ["slices", "slice"],
  ])("%s → %s", (word, unit) => {
    expect(normalizeUnit(word)).toBe(unit);
  });

  it("returns null for words that aren't units", () => {
    expect(normalizeUnit("large")).toBeNull();
    expect(normalizeUnit("")).toBeNull();
    expect(normalizeUnit("toString")).toBeNull();
  });
});
