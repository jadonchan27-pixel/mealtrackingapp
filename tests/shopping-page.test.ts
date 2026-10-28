// Build step 17 "done when": checking items persists across devices and
// corrected prices show next week.

import { describe, expect, it } from "vitest";
import { finalizeWeek } from "@/lib/plans";
import {
  shoppingListForWeek,
  updateShoppingItem,
  writeShoppingList,
} from "@/lib/shopping";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function recipe(id: number, kcal: number) {
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
    protein_g: 30,
    carbs_g: 40,
    fat_g: 15,
    cost_cents_per_serving: null,
  };
}

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

// Two weeks with the same recipes: this week (id 1) and next (id 2).
function twoWeeks() {
  return fakeRecipeTables({
    seed: {
      week_plans: [
        { id: 1, week_start: "2026-11-01", status: "draft" },
        { id: 2, week_start: "2026-11-08", status: "draft" },
      ],
      recipes: [recipe(1, 400), recipe(2, 600), recipe(3, 700), recipe(4, 250)],
      foods: [
        { id: 1, name: "eggs", section: "pantry" },
        { id: 2, name: "chicken breasts", section: "pantry" },
        { id: 3, name: "ground beef", section: "pantry" },
        { id: 4, name: "greek yogurt", section: "pantry" },
        { id: 5, name: "green onions", section: "pantry" },
        { id: 6, name: "scallions", section: "pantry" },
      ],
      recipe_ingredients: [
        { id: 1, recipe_id: 1, food_id: 1, grams: 400 },
        { id: 2, recipe_id: 1, food_id: 5, grams: 30 },
        { id: 3, recipe_id: 2, food_id: 2, grams: 900 },
        { id: 4, recipe_id: 3, food_id: 3, grams: 900 },
        { id: 5, recipe_id: 3, food_id: 6, grams: 30 },
        { id: 6, recipe_id: 4, food_id: 4, grams: 600 },
      ],
      plan_candidates: [1, 2].flatMap((week) =>
        SLOTS.map((slot, i) => ({
          id: week * 10 + i,
          week_plan_id: week,
          slot,
          recipe_id: i + 1,
          rank: 1,
          selected: true,
        })),
      ),
    },
  });
}

const TARGETS = { kcal: 3000, proteinG: 150 };

async function finalizeWithList(db: ReturnType<typeof twoWeeks>, id: number) {
  const week = await finalizeWeek(db.client, id, TARGETS);
  await writeShoppingList(db.client, id);
  return week;
}

const items = (list: Awaited<ReturnType<typeof shoppingListForWeek>>) =>
  list.sections.flatMap((s) => s.items);

describe("shopping list page", () => {
  it("keeps checked items when the list is opened again", async () => {
    const db = twoWeeks();
    const week = await finalizeWithList(db, 1);
    const [first, second] = items(await shoppingListForWeek(db.client, week));

    await updateShoppingItem(db.client, first.id, { checked: true });
    await updateShoppingItem(db.client, second.id, { checked: true });
    await updateShoppingItem(db.client, second.id, { checked: false });

    // Another device reads the list from the database.
    const reopened = items(await shoppingListForWeek(db.client, week));
    expect(reopened.find((i) => i.id === first.id)!.checked).toBe(true);
    expect(reopened.find((i) => i.id === second.id)!.checked).toBe(false);
  });

  it("uses a corrected price in next week's list", async () => {
    const db = twoWeeks();
    const week = await finalizeWithList(db, 1);
    const chicken = items(await shoppingListForWeek(db.client, week)).find(
      (i) => i.name.startsWith("Chicken breasts"),
    )!;
    expect(chicken.estimate).toBe(true);

    // Jadon paid $X for all of the chicken packages.
    const paid = chicken.packages * 449;
    const saved = await updateShoppingItem(db.client, chicken.id, {
      actualPriceCents: paid,
      checked: true,
    });
    expect(saved).toMatchObject({
      priceCents: paid,
      checked: true,
      estimate: false,
    });
    expect(db.table("heb_products").find((p) => p.food_id === 2)).toMatchObject(
      { price_cents: 449, is_estimate: false },
    );

    const next = await finalizeWithList(db, 2);
    const nextChicken = items(await shoppingListForWeek(db.client, next)).find(
      (i) => i.name.startsWith("Chicken breasts"),
    )!;
    expect(nextChicken).toMatchObject({
      priceCents: nextChicken.packages * 449,
      estimate: false,
      checked: false,
    });
  });

  it("applies a price paid for a shared line to every food on it", async () => {
    const db = twoWeeks();
    const week = await finalizeWithList(db, 1);
    const onions = items(await shoppingListForWeek(db.client, week)).filter(
      (i) => i.name.startsWith("Green onions"),
    );
    expect(onions).toHaveLength(1);

    await updateShoppingItem(db.client, onions[0].id, {
      actualPriceCents: onions[0].packages * 99,
    });
    const onionProducts = db
      .table("heb_products")
      .filter((p) => p.food_id === 5 || p.food_id === 6);
    expect(onionProducts.map((p) => [p.price_cents, p.is_estimate])).toEqual([
      [99, false],
      [99, false],
    ]);

    const next = await finalizeWithList(db, 2);
    const nextOnions = items(await shoppingListForWeek(db.client, next)).find(
      (i) => i.name.startsWith("Green onions"),
    )!;
    expect(nextOnions.priceCents).toBe(nextOnions.packages * 99);
  });

  it("refuses an unknown item", async () => {
    const db = twoWeeks();
    await expect(
      updateShoppingItem(db.client, 999, { checked: true }),
    ).rejects.toThrow("Item not found");
  });
});
