import { describe, expect, it } from "vitest";
import { confirmedTotals, parseLogPatch, parseRestaurant } from "./log";
import { isIsoDate } from "./weights";

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

describe("parseRestaurant", () => {
  const BODY = {
    date: "2026-11-03",
    slot: "dinner",
    restaurantName: "  Torchy's   Tacos ",
    itemName: "Trailer Park taco",
    kcal: 570,
    proteinG: 30,
    carbsG: 35.25,
    fatG: 34,
  };

  it("cleans up the names and defaults the amount to the whole item", () => {
    expect(parseRestaurant(BODY, isIsoDate)).toEqual({
      ok: true,
      input: {
        date: "2026-11-03",
        slot: "dinner",
        restaurantName: "Torchy's Tacos",
        itemName: "Trailer Park taco",
        amount: 1,
        kcal: 570,
        proteinG: 30,
        carbsG: 35.3,
        fatG: 34,
      },
    });
    const noRestaurant = parseRestaurant(
      { ...BODY, restaurantName: "", amount: 0.5 },
      isIsoDate,
    );
    expect(noRestaurant).toMatchObject({
      ok: true,
      input: { restaurantName: null, amount: 0.5 },
    });
  });

  it.each([
    null,
    { ...BODY, date: "Nov 3" },
    { ...BODY, slot: "brunch" },
    { ...BODY, itemName: "  " },
    { ...BODY, amount: 0 },
    { ...BODY, amount: 1.1 },
    { ...BODY, kcal: -5 },
    { ...BODY, kcal: 6000 },
    { ...BODY, fatG: "34" },
  ])("refuses %j", (body) => {
    expect(parseRestaurant(body, isIsoDate).ok).toBe(false);
  });
});
