import { describe, expect, it } from "vitest";
import {
  CUISINE_OPTIONS,
  currentWeekStart,
  isMealSlot,
  isSharedWeek,
  isSunday,
  mealsPerDay,
  parseNewWeek,
  pickCuisine,
  PLAN_SLOTS,
  planSlotLabel,
  upcomingWeekStart,
} from "./weeks";

describe("upcomingWeekStart", () => {
  it("is the coming Sunday, or today on a Sunday", () => {
    expect(upcomingWeekStart("2026-10-31")).toBe("2026-11-01"); // Saturday
    expect(upcomingWeekStart("2026-10-28")).toBe("2026-11-01"); // Wednesday
    expect(upcomingWeekStart("2026-11-01")).toBe("2026-11-01"); // Sunday
    expect(upcomingWeekStart("2026-12-28")).toBe("2027-01-03");
  });
});

describe("currentWeekStart", () => {
  it("is the Sunday on or before today", () => {
    expect(currentWeekStart("2026-11-05")).toBe("2026-11-01"); // Thursday
    expect(currentWeekStart("2026-11-01")).toBe("2026-11-01");
    expect(currentWeekStart("2027-01-02")).toBe("2026-12-27");
  });
});

describe("isSunday", () => {
  it("accepts only real Sundays", () => {
    expect(isSunday("2026-11-01")).toBe(true);
    expect(isSunday("2026-10-31")).toBe(false);
    expect(isSunday("2026-02-30")).toBe(false);
    expect(isSunday("soon")).toBe(false);
  });
});

describe("isMealSlot", () => {
  it("knows the four slots", () => {
    expect(isMealSlot("snack")).toBe(true);
    expect(isMealSlot("brunch")).toBe(false);
  });
});

describe("parseNewWeek", () => {
  it("cleans up the cuisine list", () => {
    expect(
      parseNewWeek({
        weekStart: "2026-11-01",
        cuisines: [" Indian ", "indian", "", "Middle   Eastern"],
      }),
    ).toEqual({
      ok: true,
      week: { weekStart: "2026-11-01", cuisines: ["Indian", "Middle Eastern"] },
    });
  });

  it("allows no cuisines, so the app chooses", () => {
    expect(parseNewWeek({ weekStart: "2026-11-01" })).toEqual({
      ok: true,
      week: { weekStart: "2026-11-01", cuisines: [] },
    });
  });

  it("explains what's wrong", () => {
    expect(parseNewWeek({ weekStart: "2026-10-31", cuisines: "Thai" })).toEqual(
      {
        ok: false,
        errors: {
          weekStart: "The week must start on a Sunday.",
          cuisines: "Cuisines must be a list of names.",
        },
      },
    );
    expect(
      parseNewWeek({
        weekStart: "2026-11-01",
        cuisines: ["Thai", "Indian", "Greek", "Korean"],
      }),
    ).toEqual({ ok: false, errors: { cuisines: "Choose up to 3 cuisines." } });
    expect(
      parseNewWeek({ weekStart: "2026-11-01", cuisines: ["x".repeat(41)] }),
    ).toMatchObject({ ok: false });
    expect(parseNewWeek(null)).toMatchObject({ ok: false });
  });
});

describe("pickCuisine", () => {
  it("picks a cuisine not used last week", () => {
    const lastWeek = CUISINE_OPTIONS.filter((c) => c !== "Thai");
    expect(pickCuisine(lastWeek.map((c) => c.toUpperCase()))).toBe("Thai");
  });

  it("picks from every option when all were used", () => {
    expect(CUISINE_OPTIONS).toContain(pickCuisine(CUISINE_OPTIONS, () => 0.5));
  });

  it("uses the random number to choose", () => {
    expect(pickCuisine([], () => 0)).toBe(CUISINE_OPTIONS[0]);
    expect(pickCuisine([], () => 0.999)).toBe(CUISINE_OPTIONS.at(-1));
  });
});

// US-33: breakfast, and one dish for lunch and dinner.
describe("two dishes a week", () => {
  it("plans breakfast and the shared lunch-and-dinner dish", () => {
    expect(PLAN_SLOTS).toEqual(["breakfast", "lunch"]);
    expect(mealsPerDay("lunch", true)).toBe(2);
    expect(mealsPerDay("breakfast", true)).toBe(1);
    expect(mealsPerDay("lunch", false)).toBe(1);
  });

  it("labels the shared dish only in a two-dish week", () => {
    expect(planSlotLabel("lunch", true)).toBe("Lunch & dinner");
    expect(planSlotLabel("breakfast", true)).toBe("Breakfast");
    expect(planSlotLabel("lunch", false)).toBe("Lunch");
  });

  it("tells a two-dish week from an older four-meal week", () => {
    expect(
      isSharedWeek({ items: [{ slot: "breakfast" }, { slot: "lunch" }] }),
    ).toBe(true);
    expect(
      isSharedWeek({
        items: [
          { slot: "breakfast" },
          { slot: "lunch" },
          { slot: "dinner" },
          { slot: "snack" },
        ],
      }),
    ).toBe(false);
  });
});
