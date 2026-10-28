import { describe, expect, it } from "vitest";
import type { DayEntry } from "@/lib/log";
import {
  amountLabel,
  parseAmount,
  percentOf,
  replacedSlots,
  stepPortion,
} from "./TodayLog";

describe("percentOf", () => {
  it("fills the bar up to 100%", () => {
    expect(percentOf(1550, 3100)).toBe(50);
    expect(percentOf(4000, 3100)).toBe(100);
    expect(percentOf(100, 0)).toBe(0);
  });
});

describe("stepPortion", () => {
  it("moves a quarter serving, within ¼ to 10", () => {
    expect(stepPortion(1.5, 1)).toBe(1.75);
    expect(stepPortion(1.5, -1)).toBe(1.25);
    expect(stepPortion(0.25, -1)).toBe(0.25);
    expect(stepPortion(10, 1)).toBe(10);
  });
});

describe("amountLabel", () => {
  it.each([
    [1, "the whole item"],
    [0.5, "½ the item"],
    [0.25, "¼ the item"],
    [1.5, "1½× the item"],
    [2, "2× the item"],
  ])("%d → %s", (portion, label) => {
    expect(amountLabel(portion)).toBe(label);
  });
});

describe("replacedSlots", () => {
  it("lists the slots with an eat-out", () => {
    const e = (slot: string, kind: string) => ({ slot, kind }) as DayEntry;
    expect([
      ...replacedSlots([
        e("lunch", "planned"),
        e("dinner", "planned"),
        e("dinner", "restaurant"),
      ]),
    ]).toEqual(["dinner"]);
  });
});

describe("parseAmount", () => {
  it("reads plain numbers only", () => {
    expect(parseAmount(" 570 ")).toBe(570);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12g")).toBeNull();
  });
});
