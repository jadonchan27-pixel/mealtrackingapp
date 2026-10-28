import { describe, expect, it } from "vitest";
import { longDate, shortDate } from "./WeightChart";
import { localToday } from "./WeightTracker";

describe("chart dates", () => {
  it("formats without shifting the day", () => {
    expect(shortDate("2026-11-08")).toBe("Nov 8");
    expect(shortDate("2027-01-01")).toBe("Jan 1");
    expect(longDate("2026-12-31")).toBe("Dec 31, 2026");
  });
});

describe("localToday", () => {
  it("uses the local calendar date", () => {
    expect(localToday(new Date(2026, 10, 1, 23, 30))).toBe("2026-11-01");
    expect(localToday(new Date(2026, 0, 9, 0, 5))).toBe("2026-01-09");
  });
});
