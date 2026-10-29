import { describe, expect, it } from "vitest";
import { budgetMessage } from "./Budget";

describe("budgetMessage", () => {
  it("shows the total against the budget", () => {
    expect(
      budgetMessage({
        totalCents: 7240,
        budgetCents: 8000,
        over: false,
        unpriced: 0,
      }),
    ).toEqual({
      line: "Estimated $72.40 of your $80.00 weekly budget.",
      warning: null,
      note: null,
    });
  });

  it("warns when over and counts rough guesses", () => {
    const m = budgetMessage({
      totalCents: 9150,
      budgetCents: 8000,
      over: true,
      unpriced: 2,
    });
    expect(m.warning).toBe("Over budget by $11.50.");
    expect(m.note).toBe(
      "2 items have no store price yet, so the total is a rough guess.",
    );
  });
});
