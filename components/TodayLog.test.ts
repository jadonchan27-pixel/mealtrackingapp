import { describe, expect, it } from "vitest";
import { percentOf, stepPortion } from "./TodayLog";

describe("percentOf", () => {
  it("fills the bar up to 100%", () => {
    expect(percentOf(1550, 3100)).toBe(50);
    expect(percentOf(4000, 3100)).toBe(100);
    expect(percentOf(100, 0)).toBe(0);
  });
});

describe("stepPortion", () => {
  it("moves a quarter serving, within ¼ to 10", () => {
    expect(stepPortion(1.5, 1)).toBe(1.75);
    expect(stepPortion(1.5, -1)).toBe(1.25);
    expect(stepPortion(0.25, -1)).toBe(0.25);
    expect(stepPortion(10, 1)).toBe(10);
  });
});
