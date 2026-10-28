import { describe, expect, it } from "vitest";
import { isIsoDate, parseWeighIn } from "./weights";

describe("isIsoDate", () => {
  it.each(["2026-11-01", "2024-02-29", "2026-12-31"])("accepts %s", (d) => {
    expect(isIsoDate(d)).toBe(true);
  });

  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-1-1",
    "11/01/2026",
    "",
    20261101,
    null,
  ])("rejects %o", (d) => {
    expect(isIsoDate(d)).toBe(false);
  });
});

describe("parseWeighIn", () => {
  it("accepts a date and weight", () => {
    expect(parseWeighIn({ date: "2026-11-01", weightLb: 160.4 })).toEqual({
      ok: true,
      weighIn: { date: "2026-11-01", weightLb: 160.4 },
    });
  });

  it("drops fields it doesn't know", () => {
    expect(
      parseWeighIn({ date: "2026-11-01", weightLb: 160, user_id: "x" }),
    ).toEqual({ ok: true, weighIn: { date: "2026-11-01", weightLb: 160 } });
  });

  it.each([
    ["date", { date: "2026-02-30", weightLb: 160 }],
    ["weightLb", { date: "2026-11-01", weightLb: 20 }],
    ["weightLb", { date: "2026-11-01", weightLb: "160" }],
  ])("rejects a bad %s", (field, body) => {
    const result = parseWeighIn(body);
    expect(!result.ok && Object.keys(result.errors)).toEqual([field]);
  });

  it("reports both missing fields", () => {
    const result = parseWeighIn(null);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
      "date",
      "weightLb",
    ]);
  });
});
