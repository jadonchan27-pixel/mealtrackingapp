import { describe, expect, it } from "vitest";
import type { WeekView } from "@/lib/plans";
import {
  pickedCount,
  pickedElsewhere,
  startOverMessage,
  weekLabel,
} from "./PlanBuilder";

describe("weekLabel", () => {
  it("names the Sunday the week starts", () => {
    expect(weekLabel("2026-11-01")).toBe("Sunday, Nov 1");
  });
});

describe("pickedCount", () => {
  it("counts the plan's dishes with a pick", () => {
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
    // US-33: only breakfast and the lunch-and-dinner dish count.
    expect(pickedCount(week)).toBe(1);
  });
});

describe("pickedElsewhere", () => {
  it("maps the other meals' picks by recipe", () => {
    const c = (recipeId: number, selected: boolean) =>
      ({
        selected,
        recipe: { id: recipeId },
      }) as WeekView["candidates"]["lunch"][number];
    const week = {
      candidates: {
        breakfast: [c(1, true), c(2, false)],
        lunch: [c(2, true), c(1, false)],
        dinner: [c(3, false)],
        snack: [],
      },
    } as unknown as WeekView;
    expect([...pickedElsewhere(week, "lunch")]).toEqual([[1, "breakfast"]]);
    expect([...pickedElsewhere(week, "dinner")]).toEqual([
      [1, "breakfast"],
      [2, "lunch"],
    ]);
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
