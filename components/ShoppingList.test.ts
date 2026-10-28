import { describe, expect, it } from "vitest";
import type { ShoppingList } from "@/lib/shopping";
import { formatPrice, listTotals, parseDollars } from "./ShoppingList";

describe("formatPrice", () => {
  it("shows dollars and cents", () => {
    expect(formatPrice(1234)).toBe("$12.34");
    expect(formatPrice(5)).toBe("$0.05");
  });
});

describe("parseDollars", () => {
  it.each([
    ["4.99", 499],
    ["$4.99", 499],
    ["12", 1200],
    ["3.5", 350],
    [" 0.25 ", 25],
  ])("%s → %d cents", (text, cents) => {
    expect(parseDollars(text)).toBe(cents);
  });

  it.each(["", "abc", "4.999", "-2", "12345"])("refuses %j", (text) => {
    expect(parseDollars(text)).toBeNull();
  });
});

describe("listTotals", () => {
  it("counts checked items and what's left to buy", () => {
    const item = (id: number, priceCents: number, checked: boolean) => ({
      id,
      name: `Item ${id}`,
      neededGrams: 100,
      packages: 1,
      priceCents,
      batch: "both" as const,
      checked,
      estimate: true,
    });
    const list: ShoppingList = {
      sections: [
        {
          section: "produce",
          label: "Produce",
          items: [item(1, 100, true), item(2, 250, false)],
        },
        { section: "pantry", label: "Pantry", items: [item(3, 50, false)] },
      ],
      totalCents: 400,
    };
    expect(listTotals(list)).toEqual({
      count: 3,
      checked: 1,
      totalCents: 400,
      leftCents: 300,
    });
  });
});
