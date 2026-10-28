import { describe, expect, it } from "vitest";
import { isPlainWater, typicalGrams } from "./typicalWeights";

describe("typicalGrams", () => {
  it("weighs volumes by the kind of food", () => {
    expect(typicalGrams("cup", "uncooked long grain white rice")).toBe(185);
    expect(typicalGrams("cup", "instant brown rice")).toBe(95);
    expect(typicalGrams("cup", "rice vinegar")).toBe(240);
    expect(typicalGrams("tbsp", "chia seeds")).toBeCloseTo(12, 5);
    expect(typicalGrams("cup", "spinach")).toBeNull();
  });

  it("weighs whole items, singular or plural", () => {
    expect(typicalGrams(null, "corn tortillas")).toBe(26);
    expect(typicalGrams(null, "flour tortilla")).toBe(45);
    expect(typicalGrams(null, "large mango")).toBe(336);
    expect(typicalGrams(null, "green onions")).toBe(15);
    expect(typicalGrams(null, "red onion")).toBe(110);
    expect(typicalGrams(null, "tomatoes")).toBe(123);
    expect(typicalGrams(null, "dragon fruit")).toBeNull();
  });

  it("takes a 15 oz can when no size is given", () => {
    expect(typicalGrams("can", "black beans")).toBe(425);
  });

  it("has nothing for other units", () => {
    expect(typicalGrams("slice", "bread")).toBeNull();
  });
});

describe("isPlainWater", () => {
  it("knows plain water from other drinks", () => {
    expect(isPlainWater("water")).toBe(true);
    expect(isPlainWater("Warm water")).toBe(true);
    expect(isPlainWater("coconut water")).toBe(false);
    expect(isPlainWater("water chestnuts")).toBe(false);
  });
});
