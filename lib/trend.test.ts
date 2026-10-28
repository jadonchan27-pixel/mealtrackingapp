import { describe, expect, it } from "vitest";
import { movingAverage } from "./trend";

describe("movingAverage", () => {
  it("returns nothing for no weigh-ins", () => {
    expect(movingAverage([])).toEqual([]);
  });

  it("averages up to the last 3 weigh-ins", () => {
    const points = movingAverage([
      { date: "2026-11-01", weightLb: 160 },
      { date: "2026-11-08", weightLb: 162 },
      { date: "2026-11-15", weightLb: 161 },
      { date: "2026-11-22", weightLb: 164 },
      { date: "2026-11-29", weightLb: 165 },
    ]);
    expect(points.map((p) => p.trendLb)).toEqual([
      160, // 160
      161, // (160 + 162) / 2
      161, // (160 + 162 + 161) / 3
      162.3, // (162 + 161 + 164) / 3 = 162.33
      163.3, // (161 + 164 + 165) / 3 = 163.33
    ]);
  });

  it("sorts by date first", () => {
    const points = movingAverage([
      { date: "2026-11-15", weightLb: 164 },
      { date: "2026-11-01", weightLb: 160 },
      { date: "2026-11-08", weightLb: 162 },
    ]);
    expect(points).toEqual([
      { date: "2026-11-01", weightLb: 160, trendLb: 160 },
      { date: "2026-11-08", weightLb: 162, trendLb: 161 },
      { date: "2026-11-15", weightLb: 164, trendLb: 162 },
    ]);
  });

  it("rounds to one decimal", () => {
    const points = movingAverage([
      { date: "2026-11-01", weightLb: 160.2 },
      { date: "2026-11-08", weightLb: 160.3 },
    ]);
    expect(points[1].trendLb).toBe(160.3); // 160.25 rounds up
  });

  it("doesn't change the input", () => {
    const input = [
      { date: "2026-11-08", weightLb: 162 },
      { date: "2026-11-01", weightLb: 160 },
    ];
    movingAverage(input);
    expect(input[0].date).toBe("2026-11-08");
  });

  it("supports another window and rejects a bad one", () => {
    const entries = [
      { date: "2026-11-01", weightLb: 160 },
      { date: "2026-11-08", weightLb: 170 },
    ];
    expect(movingAverage(entries, 1).map((p) => p.trendLb)).toEqual([160, 170]);
    expect(() => movingAverage(entries, 0)).toThrow();
    expect(() => movingAverage(entries, 1.5)).toThrow();
  });
});
