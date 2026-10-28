import { describe, expect, it } from "vitest";
import type { WeekView } from "@/lib/plans";
import { pickedCount, weekLabel } from "./PlanBuilder";

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
