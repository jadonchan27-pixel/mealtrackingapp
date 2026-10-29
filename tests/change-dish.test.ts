// Build step 20h "done when": changing a finalized week's dish mid-week
// leaves earlier days' entries on the old dish and gives today onward the new
// one at rescaled portions, with the shopping list built from the new dishes.

import { describe, expect, it } from "vitest";
import {
  addRestaurantEntry,
  deleteRestaurantEntry,
  updateLogEntry,
} from "@/lib/log";
import { changeDish, finalizeWeek, loadWeekById } from "@/lib/plans";
import { writeShoppingList } from "@/lib/shopping";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function recipe(id: number, kcal: number, protein: number) {
  return {
    id,
    title: `Recipe ${id}`,
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

const TARGETS = { kcal: 2700, proteinG: 120 };

async function finalWeek() {
  const db = fakeRecipeTables({
    seed: {
      week_plans: [
        {
          id: 1,
          week_start: "2026-11-01",
          cuisines: ["Mexican"],
          status: "draft",
        },
      ],
      recipes: [recipe(1, 450, 25), recipe(2, 600, 40), recipe(3, 300, 30)],
      foods: [
        { id: 1, name: "chicken thighs", section: "meat_seafood" },
        { id: 2, name: "black beans", section: "pantry" },
      ],
      recipe_ingredients: [
        {
          id: 1,
          recipe_id: 2,
          food_id: 1,
          raw_text: "2 lb chicken thighs",
          grams: 907,
        },
        {
          id: 2,
          recipe_id: 3,
          food_id: 2,
          raw_text: "2 cans black beans",
          grams: 850,
        },
      ],
      plan_candidates: [
        {
          id: 1,
          week_plan_id: 1,
          slot: "breakfast",
          recipe_id: 1,
          rank: 1,
          selected: true,
        },
        {
          id: 2,
          week_plan_id: 1,
          slot: "lunch",
          recipe_id: 2,
          rank: 1,
          selected: true,
        },
        {
          id: 3,
          week_plan_id: 1,
          slot: "lunch",
          recipe_id: 3,
          rank: 2,
          selected: false,
        },
      ],
    },
  });
  const week = await finalizeWeek(db.client, 1, TARGETS);
  return { db, week };
}

const entriesOn = (
  db: Awaited<ReturnType<typeof finalWeek>>["db"],
  date: string,
) =>
  db
    .table("log_entries")
    .filter((e) => e.date === date)
    .sort((a, b) => String(a.slot).localeCompare(String(b.slot)));

describe("changeDish", () => {
  it("moves today onward to the new dish at rescaled portions", async () => {
    const { db, week } = await finalWeek();
    const oldItems = Object.fromEntries(week.items.map((i) => [i.slot, i]));
    // Wednesday's lunch is already eaten.
    const wedLunch = entriesOn(db, "2026-11-04").find(
      (e) => e.slot === "lunch",
    )!;
    await updateLogEntry(db.client, wedLunch.id as number, {
      status: "confirmed",
    });

    const changed = await changeDish(db.client, 1, 3, TARGETS, "2026-11-04");

    const items = Object.fromEntries(changed.items.map((i) => [i.slot, i]));
    expect(items.lunch.recipe.id).toBe(3);
    expect(items.breakfast.recipe.id).toBe(1);
    expect(changed.candidates.lunch.find((c) => c.selected)?.id).toBe(3);
    // The lighter dish takes more servings to fill two meals.
    expect(items.lunch.servingsPerDay).toBeGreaterThan(
      oldItems.lunch.servingsPerDay,
    );

    // Earlier days keep the old dish and portions.
    for (const date of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
      for (const e of entriesOn(db, date)) {
        const old =
          e.slot === "breakfast" ? oldItems.breakfast : oldItems.lunch;
        expect(e.plan_item_id).toBe(old.id);
        expect(e.portion).toBe(
          e.slot === "breakfast" ? old.servingsPerDay : old.servingsPerDay / 2,
        );
      }
    }
    // Wednesday: the eaten lunch stays; dinner is the new dish.
    expect(
      entriesOn(db, "2026-11-04").map((e) => [
        e.slot,
        e.plan_item_id,
        e.status,
      ]),
    ).toEqual([
      ["breakfast", oldItems.breakfast.id, "planned"],
      ["dinner", items.lunch.id, "planned"],
      ["lunch", oldItems.lunch.id, "confirmed"],
    ]);
    // Thursday to Saturday: all new portions.
    for (const date of ["2026-11-05", "2026-11-06", "2026-11-07"]) {
      expect(
        entriesOn(db, date).map((e) => [e.slot, e.plan_item_id, e.portion]),
      ).toEqual([
        ["breakfast", items.breakfast.id, items.breakfast.servingsPerDay],
        ["dinner", items.lunch.id, items.lunch.servingsPerDay / 2],
        ["lunch", items.lunch.id, items.lunch.servingsPerDay / 2],
      ]);
    }
    // The old dish's item stays for the days that used it.
    expect(db.table("plan_items")).toHaveLength(3);

    // The shopping list follows the current dishes.
    await writeShoppingList(db.client, 1);
    const foods = db.table("shopping_list_items").map((l) => l.food_id);
    expect(foods).toContain(2);
    expect(foods).not.toContain(1);

    // Reading the week back gives the new plan.
    const loaded = await loadWeekById(db.client, 1);
    expect(loaded.items.map((i) => i.recipe.id)).toEqual([1, 3]);
  });

  it("replaces the whole week before it starts, and can switch back", async () => {
    const { db } = await finalWeek();
    await changeDish(db.client, 1, 3, TARGETS, "2026-10-29");
    expect(
      db
        .table("plan_items")
        .map((i) => i.recipe_id)
        .sort(),
    ).toEqual([1, 3]);
    expect(db.table("log_entries")).toHaveLength(21);

    const back = await changeDish(db.client, 1, 2, TARGETS, "2026-10-29");
    expect(back.items.map((i) => i.recipe.id)).toEqual([1, 2]);
    expect(db.table("log_entries")).toHaveLength(21);
  });

  it("keeps a later eat-out and skip skipped, as the new dish", async () => {
    const { db, week } = await finalWeek();
    const oldLunch = week.items.find((i) => i.slot === "lunch")!;
    await addRestaurantEntry(db.client, {
      date: "2026-11-05",
      slot: "dinner",
      restaurantName: "Torchy's Tacos",
      itemName: "Trailer Park taco",
      amount: 1,
      kcal: 570,
      proteinG: 30,
      carbsG: 35,
      fatG: 34,
    });
    const friLunch = entriesOn(db, "2026-11-06").find(
      (e) => e.slot === "lunch",
    )!;
    await updateLogEntry(db.client, friLunch.id as number, {
      status: "skipped",
    });

    const changed = await changeDish(db.client, 1, 3, TARGETS, "2026-11-04");
    const lunch = changed.items.find((i) => i.slot === "lunch")!;
    const planned = (date: string, slot: string) =>
      entriesOn(db, date).filter(
        (e) => e.slot === slot && e.kind === "planned",
      );
    for (const [date, slot] of [
      ["2026-11-05", "dinner"],
      ["2026-11-06", "lunch"],
    ]) {
      expect(
        planned(date, slot).map((e) => [e.plan_item_id, e.status, e.portion]),
      ).toEqual([[lunch.id, "skipped", lunch.servingsPerDay / 2]]);
    }
    // Days from today no longer use the old dish.
    expect(
      db
        .table("log_entries")
        .filter((e) => e.plan_item_id === oldLunch.id)
        .every((e) => String(e.date) < "2026-11-04"),
    ).toBe(true);

    // Undoing either brings back the new dish, not the old one.
    const tacos = entriesOn(db, "2026-11-05").find(
      (e) => e.kind === "restaurant",
    )!;
    await deleteRestaurantEntry(db.client, tacos.id as number);
    await updateLogEntry(db.client, friLunch.id as number, {
      status: "planned",
    });
    for (const [date, slot] of [
      ["2026-11-05", "dinner"],
      ["2026-11-06", "lunch"],
    ]) {
      expect(
        planned(date, slot).map((e) => [e.plan_item_id, e.status]),
      ).toEqual([[lunch.id, "planned"]]);
    }
  });

  it("removes the old dish once a change before the week starts frees it", async () => {
    const { db, week } = await finalWeek();
    const oldLunch = week.items.find((i) => i.slot === "lunch")!;
    await addRestaurantEntry(db.client, {
      date: "2026-11-02",
      slot: "lunch",
      restaurantName: "Torchy's Tacos",
      itemName: "Trailer Park taco",
      amount: 1,
      kcal: 570,
      proteinG: 30,
      carbsG: 35,
      fatG: 34,
    });
    await changeDish(db.client, 1, 3, TARGETS, "2026-10-29");
    expect(db.table("plan_items").some((i) => i.id === oldLunch.id)).toBe(
      false,
    );
  });

  it("refuses a draft, a finished week and the current dish", async () => {
    const { db } = await finalWeek();
    await expect(
      changeDish(db.client, 1, 3, TARGETS, "2026-11-08"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      changeDish(db.client, 1, 2, TARGETS, "2026-11-02"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      changeDish(db.client, 1, 99, TARGETS, "2026-11-02"),
    ).rejects.toMatchObject({ status: 404 });
    // The breakfast recipe can't also be the lunch-and-dinner dish.
    db.table("plan_candidates").push({
      id: 4,
      week_plan_id: 1,
      slot: "lunch",
      recipe_id: 1,
      rank: 3,
      selected: false,
    });
    await expect(
      changeDish(db.client, 1, 4, TARGETS, "2026-11-02"),
    ).rejects.toMatchObject({ status: 409 });

    const draft = fakeRecipeTables({
      seed: {
        week_plans: [{ id: 1, week_start: "2026-11-01", status: "draft" }],
      },
    });
    await expect(
      changeDish(draft.client, 1, 1, TARGETS, "2026-11-02"),
    ).rejects.toMatchObject({ status: 409 });
  });
});
