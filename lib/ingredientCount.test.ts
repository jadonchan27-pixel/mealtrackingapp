import { describe, expect, it } from "vitest";
import {
  countIngredients,
  inIngredientRange,
  isPantryStaple,
} from "./ingredientCount";

describe("isPantryStaple", () => {
  it("knows salt, pepper, cooking oil and water", () => {
    for (const food of [
      "salt",
      "kosher salt",
      "Black pepper",
      "freshly ground black pepper",
      "salt and pepper",
      "Kosher salt & freshly ground black pepper",
      "olive oil",
      "extra-virgin olive oil",
      "vegetable oil",
      "oil",
      "cooking spray",
      "water",
      "warm water",
    ]) {
      expect(isPantryStaple(food), food).toBe(true);
    }
  });

  it("counts flavorings and other peppers and oils", () => {
    for (const food of [
      "sesame oil",
      "red pepper flakes",
      "bell pepper",
      "cayenne pepper",
      "garlic salt",
      "coconut water",
      "chicken breast",
    ]) {
      expect(isPantryStaple(food), food).toBe(false);
    }
  });
});

describe("countIngredients", () => {
  it("leaves out staples, optional lines and headings", () => {
    expect(
      countIngredients([
        "For the chicken:",
        "1 lb chicken breast",
        "1 cup rice",
        "2 tbsp olive oil",
        "Salt and pepper to taste",
        "1 cup water",
        "1/4 cup cilantro (optional)",
        "1 lime, juiced",
        "Fresh parsley for garnish",
      ]),
    ).toBe(4);
  });
});

describe("inIngredientRange", () => {
  it("checks the min and max, either of which can be open", () => {
    expect(inIngredientRange(4, { min: 3, max: 5 })).toBe(true);
    expect(inIngredientRange(6, { min: 3, max: 5 })).toBe(false);
    expect(inIngredientRange(2, { min: 3, max: null })).toBe(false);
    expect(inIngredientRange(20, { min: null, max: null })).toBe(true);
  });
});
