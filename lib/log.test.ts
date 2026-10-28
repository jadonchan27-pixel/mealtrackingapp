import { describe, expect, it } from "vitest";
import { confirmedTotals, parseLogPatch } from "./log";

const n = (kcal: number, proteinG: number, carbsG: number, fatG: number) => ({
  kcal,
  proteinG,
  carbsG,
  fatG,
});

describe("confirmedTotals", () => {
  it("adds up confirmed entries only", () => {
    expect(
      confirmedTotals([
        { status: "confirmed", nutrition: n(500.4, 30.2, 40, 15) },
        { status: "planned", nutrition: n(800, 50, 60, 20) },
        { status: "skipped", nutrition: n(700, 40, 50, 25) },
        { status: "confirmed", nutrition: n(250.3, 14.4, 30, 5) },
      ]),
    ).toEqual(n(751, 45, 70, 20));
    expect(confirmedTotals([])).toEqual(n(0, 0, 0, 0));
  });
});

describe("parseLogPatch", () => {
  it("takes a status and/or a portion in quarters", () => {
    expect(parseLogPatch({ status: "confirmed" })).toEqual({
      ok: true,
      patch: { status: "confirmed" },
    });
    expect(parseLogPatch({ status: "skipped", portion: 1.75 })).toEqual({
      ok: true,
      patch: { status: "skipped", portion: 1.75 },
    });
  });

  it.each([
    null,
    {},
    { status: "eaten" },
    { portion: 0 },
    { portion: 1.1 },
    { portion: 10.25 },
    { portion: "1" },
  ])("refuses %j", (body) => {
    expect(parseLogPatch(body).ok).toBe(false);
  });
});
