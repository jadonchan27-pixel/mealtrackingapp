import { describe, expect, it } from "vitest";
import { dailyServingsLabel, offTarget, servingsLabel } from "./FinalWeek";

describe("servingsLabel", () => {
  it("shows quarter servings as fractions", () => {
    expect(servingsLabel(1)).toBe("1 serving");
    expect(servingsLabel(1.5)).toBe("1½ servings");
    expect(servingsLabel(0.75)).toBe("¾ serving");
    expect(servingsLabel(2.25)).toBe("2¼ servings");
  });
});

describe("offTarget", () => {
  it("shows how far a total is from the target", () => {
    expect(offTarget(2950, 2900)).toBe("+2%");
    expect(offTarget(2550, 2900)).toBe("−12%");
    expect(offTarget(2901, 2900)).toBe("on target");
  });
});

describe("dailyServingsLabel", () => {
  it("splits the lunch-and-dinner dish by meal", () => {
    expect(dailyServingsLabel(2, 1)).toBe("2 servings a day");
    expect(dailyServingsLabel(3, 2)).toBe(
      "1½ servings at lunch and 1½ at dinner",
    );
    expect(dailyServingsLabel(1.5, 2)).toBe(
      "¾ serving at lunch and ¾ at dinner",
    );
  });
});
