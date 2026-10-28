// Build step 13 "done when": a finalized plan's daily totals are within 5% of
// the calorie target.

import { describe, expect, it } from "vitest";
import {
  finalizeWeek,
  loadWeek,
  planDailyTotals,
  weekDates,
} from "@/lib/plans";
import { KCAL_TOLERANCE } from "@/lib/scaling";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function recipe(id: number, title: string, kcal: number, protein: number) {
  return {
    id,
    title,
    source_url: `https://x.test/${id}`,
    photo_url: null,
    cuisine: "Mexican",
    servings: 4,
    active_minutes: 30,
    steps: [],
    kcal,
    protein_g: protein,
    carbs_g: 40,
    fat_g: 15,
    cost_cents_per_serving: null,
  };
}

const RECIPES = [
  recipe(1, "Eggs a la Mexicana", 380, 22),
  recipe(2, "Fiesta Chicken", 540, 42),
  recipe(3, "Beef Skillet", 690, 48),
  recipe(4, "Mango Yogurt Bowl", 260, 14),
  recipe(5, "Huevos Rancheros", 450, 20),
];

function draftWeek(picks: [string, number][]) {
  return fakeRecipeTables({
    seed: {
      week_plans: [
        {
          id: 1,
          week_start: "2026-11-01",
          cuisines: ["Mexican"],
          status: "draft",
        },
      ],
      recipes: RECIPES,
      plan_candidates: [
        ...picks.map(([slot, recipeId], i) => ({
          id: i + 1,
          week_plan_id: 1,
          slot,
          recipe_id: recipeId,
          rank: 1,
          selected: true,
        })),
        // An unpicked candidate is left out of the plan.
        {
          id: 9,
          week_plan_id: 1,
          slot: "breakfast",
          recipe_id: 5,
          rank: 2,
          selected: false,
        },
      ],
    },
  });
}

const ALL_PICKED: [string, number][] = [
  ["breakfast", 1],
  ["lunch", 2],
  ["dinner", 3],
  ["snack", 4],
];

describe("weekDates", () => {
  it("lists Sunday to Saturday", () => {
    expect(weekDates("2026-12-27")).toEqual([
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });
});

describe("finalizeWeek", () => {
  it("lands each day within 5% of the calorie target", async () => {
    for (const kcal of [2000, 2450, 2900, 3400]) {
      const db = draftWeek(ALL_PICKED);
      const week = await finalizeWeek(db.client, 1, { kcal, proteinG: 150 });
      const totals = planDailyTotals(week.items);
      expect(Math.abs(totals.kcal - kcal) / kcal, `${kcal} kcal`).toBeLessThan(
        KCAL_TOLERANCE,
      );
    }
  });

  it("writes a plan item per slot and a planned log entry per day and slot", async () => {
    const db = draftWeek(ALL_PICKED);
    const week = await finalizeWeek(db.client, 1, {
      kcal: 2900,
      proteinG: 150,
    });

    expect(week.status).toBe("final");
    expect(week.items.map((i) => [i.slot, i.recipe.id])).toEqual([
      ["breakfast", 1],
      ["lunch", 2],
      ["dinner", 3],
      ["snack", 4],
    ]);
    const items = db.table("plan_items");
    expect(items).toHaveLength(4);

    const entries = db.table("log_entries");
    expect(entries).toHaveLength(28);
    expect(new Set(entries.map((e) => e.date))).toEqual(
      new Set(weekDates("2026-11-01")),
    );
    for (const e of entries) {
      const item = items.find((i) => i.id === e.plan_item_id)!;
      expect(e).toMatchObject({
        kind: "planned",
        status: "planned",
        slot: item.slot,
        portion: item.servings_per_day,
      });
    }
    expect(db.table("week_plans")[0].status).toBe("final");

    // Reading the week back gives the same plan.
    const loaded = (await loadWeek(db.client, "2026-11-01"))!;
    expect(loaded.items.map((i) => i.servingsPerDay)).toEqual(
      week.items.map((i) => i.servingsPerDay),
    );
  });

  it("needs a pick for every slot", async () => {
    const db = draftWeek(ALL_PICKED.slice(0, 3));
    await expect(
      finalizeWeek(db.client, 1, { kcal: 2900, proteinG: 150 }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Pick a recipe for snack first",
    });
    expect(db.table("plan_items")).toHaveLength(0);
  });

  it("can't finalize twice", async () => {
    const db = draftWeek(ALL_PICKED);
    await finalizeWeek(db.client, 1, { kcal: 2900, proteinG: 150 });
    await expect(
      finalizeWeek(db.client, 1, { kcal: 2900, proteinG: 150 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.table("log_entries")).toHaveLength(28);
  });
});
