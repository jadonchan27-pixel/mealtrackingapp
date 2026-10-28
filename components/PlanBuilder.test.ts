import { describe, expect, it } from "vitest";
import type { WeekView } from "@/lib/plans";
import { pickedCount, startOverMessage, weekLabel } from "./PlanBuilder";

describe("weekLabel", () => {
  it("names the Sunday the week starts", () => {
    expect(weekLabel("2026-11-01")).toBe("Sunday, Nov 1");
  });
});

describe("pickedCount", () => {
  it("counts slots with a pick", () => {
    const pick = (selected: boolean) =>
      ({ selected }) as WeekView["candidates"]["lunch"][number];
    const week = {
      candidates: {
        breakfast: [pick(true), pick(false)],
        lunch: [pick(false)],
        dinner: [],
        snack: [pick(true)],
      },
    } as unknown as WeekView;
    expect(pickedCount(week)).toBe(2);
  });
});

describe("startOverMessage", () => {
  it("says what is cleared", () => {
    expect(
      startOverMessage({
        weekStart: "2026-11-01",
        status: "draft",
        loggedMeals: 0,
      }),
    ).toBe(
      "Start the week of Sunday, Nov 1 over? This clears the shortlist and your picks, and you choose cuisines again.",
    );
  });

  it("warns about meals already logged", () => {
    const message = startOverMessage({
      weekStart: "2026-11-01",
      status: "final",
      loggedMeals: 3,
    });
    expect(message).toContain(
      "the finalized plan, the shortlist and your picks",
    );
    expect(message).toContain("You've already logged 3 meals this week.");
    expect(
      startOverMessage({
        weekStart: "2026-11-01",
        status: "final",
        loggedMeals: 1,
      }),
    ).toContain("logged 1 meal this week");
  });
});
