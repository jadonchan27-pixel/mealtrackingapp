// Build step 18 "done when": only confirmed items count toward totals.

import { describe, expect, it } from "vitest";
import { loadDay, updateLogEntry } from "@/lib/log";
import { finalizeWeek } from "@/lib/plans";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function recipe(id: number, title: string, kcal: number, protein: number) {
  return {
    id,
    title,
    source_url: `https://x.test/${id}`,
    photo_url: `https://x.test/${id}.jpg`,
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

async function finalizedWeek() {
  const db = fakeRecipeTables({
    seed: {
      week_plans: [{ id: 1, week_start: "2026-11-01", status: "draft" }],
      recipes: [
        recipe(1, "Eggs a la Mexicana", 380, 22),
        recipe(2, "Fiesta Chicken", 540, 42),
        recipe(3, "Beef Skillet", 690, 48),
        recipe(4, "Mango Yogurt Bowl", 260, 14),
      ],
      plan_candidates: ["breakfast", "lunch", "dinner", "snack"].map(
        (slot, i) => ({
          id: i + 1,
          week_plan_id: 1,
          slot,
          recipe_id: i + 1,
          rank: 1,
          selected: true,
        }),
      ),
    },
  });
  const week = await finalizeWeek(db.client, 1, {
    kcal: 3100,
    proteinG: 160,
  });
  return { db, week };
}

describe("today's log", () => {
  it("lists the day's planned meals with portions and nutrition", async () => {
    const { db, week } = await finalizedWeek();
    const day = await loadDay(db.client, "2026-11-03");
    expect(day.entries.map((e) => e.slot)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ]);
    const lunch = day.entries[1];
    const servings = week.items.find((i) => i.slot === "lunch")!.servingsPerDay;
    expect(lunch).toMatchObject({
      title: "Fiesta Chicken",
      recipeId: 2,
      photoUrl: "https://x.test/2.jpg",
      status: "planned",
      portion: servings,
      perPortion: { kcal: 540, proteinG: 42 },
      nutrition: { kcal: 540 * servings, proteinG: 42 * servings },
    });
    // Nothing is confirmed yet.
    expect(day.totals).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("counts only confirmed items, at the portion eaten", async () => {
    const { db } = await finalizedWeek();
    const [breakfast, lunch, dinner] = (await loadDay(db.client, "2026-11-03"))
      .entries;

    await updateLogEntry(db.client, breakfast.id, { status: "confirmed" });
    const ate = await updateLogEntry(db.client, lunch.id, {
      status: "confirmed",
      portion: 1.5,
    });
    expect(ate).toMatchObject({
      status: "confirmed",
      portion: 1.5,
      nutrition: { kcal: 810, proteinG: 63 },
    });
    await updateLogEntry(db.client, dinner.id, { status: "skipped" });

    const day = await loadDay(db.client, "2026-11-03");
    expect(day.totals).toEqual({
      kcal: Math.round(breakfast.nutrition.kcal + 810),
      proteinG: Math.round(breakfast.nutrition.proteinG + 63),
      carbsG: Math.round(breakfast.nutrition.carbsG + 60),
      fatG: Math.round(breakfast.nutrition.fatG + 22.5),
    });

    // Undoing a confirm takes it back out of the totals.
    await updateLogEntry(db.client, breakfast.id, { status: "planned" });
    expect((await loadDay(db.client, "2026-11-03")).totals.kcal).toBe(810);

    // Other days are untouched.
    expect((await loadDay(db.client, "2026-11-04")).totals.kcal).toBe(0);
  });

  it("counts a restaurant entry by its own numbers", async () => {
    const { db } = await finalizedWeek();
    db.table("log_entries").push({
      id: 900,
      date: "2026-11-03",
      slot: "dinner",
      kind: "restaurant",
      status: "confirmed",
      plan_item_id: null,
      portion: 1,
      restaurant_name: "Torchy's",
      item_name: "Trailer Park taco",
      kcal: 600,
      protein_g: 30,
      carbs_g: 40,
      fat_g: 35,
    });
    const day = await loadDay(db.client, "2026-11-03");
    const dinners = day.entries.filter((e) => e.slot === "dinner");
    expect(dinners.map((e) => e.kind)).toEqual(["planned", "restaurant"]);
    expect(dinners[1]).toMatchObject({
      title: "Trailer Park taco",
      restaurantName: "Torchy's",
      recipeId: null,
    });
    expect(day.totals).toEqual({
      kcal: 600,
      proteinG: 30,
      carbsG: 40,
      fatG: 35,
    });
  });

  it("refuses an unknown entry", async () => {
    const { db } = await finalizedWeek();
    await expect(
      updateLogEntry(db.client, 99_999, { status: "confirmed" }),
    ).rejects.toThrow("Entry not found");
  });
});
