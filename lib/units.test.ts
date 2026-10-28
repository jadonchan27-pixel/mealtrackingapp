import { describe, expect, it } from "vitest";
import {
  cmToIn,
  convertCooking,
  ftInToIn,
  inToCm,
  inToFtIn,
  isMassUnit,
  isVolumeUnit,
  kgToLb,
  lbToKg,
  toGrams,
  toMl,
} from "./units";

describe("body units", () => {
  it("converts pounds and kilograms", () => {
    expect(lbToKg(1)).toBe(0.45359237);
    expect(lbToKg(160)).toBeCloseTo(72.5748, 4);
    expect(kgToLb(100)).toBeCloseTo(220.4623, 4);
    expect(kgToLb(lbToKg(183.5))).toBeCloseTo(183.5, 10);
  });

  it("converts inches and centimetres", () => {
    expect(inToCm(1)).toBe(2.54);
    expect(inToCm(70)).toBeCloseTo(177.8, 10);
    expect(cmToIn(254)).toBeCloseTo(100, 10);
  });

  it("converts feet and inches", () => {
    expect(ftInToIn(5, 10)).toBe(70);
    expect(ftInToIn(6, 0)).toBe(72);
    expect(inToFtIn(70)).toEqual({ feet: 5, inches: 10 });
    expect(inToFtIn(72)).toEqual({ feet: 6, inches: 0 });
    expect(inToFtIn(65.5)).toEqual({ feet: 5, inches: 5.5 });
  });
});

describe("cooking units", () => {
  it("converts volumes", () => {
    expect(convertCooking(3, "tsp", "tbsp")).toBeCloseTo(1, 10);
    expect(convertCooking(16, "tbsp", "cup")).toBeCloseTo(1, 10);
    expect(convertCooking(1, "cup", "fl_oz")).toBeCloseTo(8, 10);
    expect(convertCooking(2, "pint", "quart")).toBeCloseTo(1, 10);
    expect(convertCooking(4, "quart", "gallon")).toBeCloseTo(1, 10);
    expect(convertCooking(1, "l", "ml")).toBe(1000);
    expect(toMl(1, "cup")).toBeCloseTo(236.588, 3);
  });

  it("converts masses", () => {
    expect(convertCooking(16, "oz", "lb")).toBeCloseTo(1, 10);
    expect(convertCooking(1, "kg", "g")).toBe(1000);
    expect(toGrams(1, "oz")).toBeCloseTo(28.3495, 4);
    expect(toGrams(2, "lb")).toBeCloseTo(907.185, 3);
  });

  it("refuses volume to mass without a density", () => {
    expect(() => convertCooking(1, "cup", "g")).toThrow("density");
    expect(() => convertCooking(1, "oz", "fl_oz")).toThrow("density");
  });

  it("classifies units", () => {
    expect(isVolumeUnit("cup")).toBe(true);
    expect(isVolumeUnit("oz")).toBe(false);
    expect(isMassUnit("oz")).toBe(true);
    expect(isMassUnit("toString")).toBe(false);
  });
});
