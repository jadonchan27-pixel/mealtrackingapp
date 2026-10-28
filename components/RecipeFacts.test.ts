import { describe, expect, it } from "vitest";
import { formatCost, formatMinutes } from "./RecipeFacts";

describe("formatMinutes", () => {
  it("shows minutes and hours", () => {
    expect(formatMinutes(35)).toBe("35 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(65)).toBe("1 hr 5 min");
    expect(formatMinutes(null)).toBe("Time not given");
  });
});

describe("formatCost", () => {
  it("shows dollars a serving, or nothing when unknown", () => {
    expect(formatCost(235)).toBe("$2.35 a serving");
    expect(formatCost(null)).toBeNull();
  });
});
