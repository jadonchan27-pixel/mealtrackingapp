// Build step 19 "done when": the restaurant item replaces the planned meal in
// the day's totals.

import { describe, expect, it } from "vitest";
import {
  addRestaurantEntry,
  deleteRestaurantEntry,
  loadDay,
  updateLogEntry,
  type RestaurantInput,
} from "@/lib/log";
import { finalizeWeek, loadWeek, resetWeek, startWeek } from "@/lib/plans";
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

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

function seed() {
  return {
    week_plans: [{ id: 1, week_start: "2026-11-01", status: "draft" }],
    recipes: [
      recipe(1, "Eggs a la Mexicana", 380, 22),
      recipe(2, "Fiesta Chicken", 540, 42),
      recipe(3, "Beef Skillet", 690, 48),
      recipe(4, "Mango Yogurt Bowl", 260, 14),
    ],
    plan_candidates: SLOTS.map((slot, i) => ({
      id: i + 1,
      week_plan_id: 1,
      slot,
      recipe_id: i + 1,
      rank: 1,
      selected: true,
    })),
  };
}

async function finalized() {
  const db = fakeRecipeTables({ seed: seed() });
  await finalizeWeek(db.client, 1, { kcal: 3100, proteinG: 160 });
  return db;
}

const TACOS: RestaurantInput = {
  date: "2026-11-03",
  slot: "dinner",
  restaurantName: "Torchy's Tacos",
  itemName: "Trailer Park taco",
  amount: 2,
  kcal: 570,
  proteinG: 30,
  carbsG: 35,
  fatG: 34,
};

describe("eating out", () => {
  it("replaces the planned meal in the day's totals", async () => {
    const db = await finalized();
    const before = await loadDay(db.client, "2026-11-03");
    for (const e of before.entries) {
      await updateLogEntry(db.client, e.id, { status: "confirmed" });
    }
    const planned = await loadDay(db.client, "2026-11-03");
    const plannedDinner = planned.entries.find((e) => e.slot === "dinner")!;

    const day = await addRestaurantEntry(db.client, TACOS);
    const dinners = day.entries.filter((e) => e.slot === "dinner");
    expect(dinners.map((e) => [e.kind, e.status])).toEqual([
      ["planned", "skipped"],
      ["restaurant", "confirmed"],
    ]);
    expect(dinners[1]).toMatchObject({
      title: "Trailer Park taco",
      restaurantName: "Torchy's Tacos",
      portion: 2,
      nutrition: { kcal: 1140, proteinG: 60, carbsG: 70, fatG: 68 },
    });
    // The rest of the day is not rebalanced.
    expect(day.totals.kcal).toBe(
      Math.round(planned.totals.kcal - plannedDinner.nutrition.kcal + 1140),
    );
    const others = day.entries.filter((e) => e.slot !== "dinner");
    expect(others.every((e) => e.status === "confirmed")).toBe(true);
  });

  it("keeps the replaced meal skipped until the eat-out is removed", async () => {
    const db = await finalized();
    const day = await addRestaurantEntry(db.client, TACOS);
    const [planned, eatOut] = day.entries.filter((e) => e.slot === "dinner");

    for (const status of ["planned", "confirmed"] as const) {
      await expect(
        updateLogEntry(db.client, planned.id, { status }),
      ).rejects.toMatchObject({ status: 409 });
    }
    expect((await loadDay(db.client, "2026-11-03")).totals.kcal).toBe(1140);

    // Removing it brings the planned dinner back, not counted until eaten.
    const after = await deleteRestaurantEntry(db.client, eatOut.id);
    expect(after.entries.filter((e) => e.slot === "dinner")).toMatchObject([
      { kind: "planned", status: "planned" },
    ]);
    expect(after.totals.kcal).toBe(0);
    await updateLogEntry(db.client, planned.id, { status: "confirmed" });
  });

  it("only removes eat-outs", async () => {
    const db = await finalized();
    const [breakfast] = (await loadDay(db.client, "2026-11-03")).entries;
    await expect(
      deleteRestaurantEntry(db.client, breakfast.id),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      deleteRestaurantEntry(db.client, 99_999),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("works on a day with nothing planned", async () => {
    const db = fakeRecipeTables();
    const day = await addRestaurantEntry(db.client, {
      ...TACOS,
      date: "2026-10-28",
      amount: 1,
    });
    expect(day.entries).toHaveLength(1);
    expect(day.totals.kcal).toBe(570);
  });

  it("counts an eat-out once in the Start over warning, and keeps it after re-finalizing", async () => {
    const db = await finalized();
    await addRestaurantEntry(db.client, TACOS);
    expect((await loadWeek(db.client, "2026-11-01"))!.loggedMeals).toBe(1);

    await resetWeek(db.client, 1);
    const week = await startWeek(db.client, {
      weekStart: "2026-11-01",
      cuisines: ["Mexican"],
    });
    // Same picks again.
    for (const [i, slot] of SLOTS.entries()) {
      db.table("plan_candidates").push({
        id: 100 + i,
        week_plan_id: week.id,
        slot,
        recipe_id: i + 1,
        rank: 1,
        selected: true,
      });
    }
    await finalizeWeek(db.client, week.id, { kcal: 3100, proteinG: 160 });

    const day = await loadDay(db.client, "2026-11-03");
    expect(
      day.entries
        .filter((e) => e.slot === "dinner")
        .map((e) => [e.kind, e.status]),
    ).toEqual([
      ["planned", "skipped"],
      ["restaurant", "confirmed"],
    ]);
    expect(day.totals.kcal).toBe(1140);
    // Other days' dinners are planned as usual.
    const tomorrow = await loadDay(db.client, "2026-11-04");
    expect(tomorrow.entries.every((e) => e.status === "planned")).toBe(true);
  });
});
