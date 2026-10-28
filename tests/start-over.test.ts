// Build step 14b "done when": after starting over, the week has no
// candidates, plan items or planned log entries, and Jadon can pick a
// different cuisine and build a new shortlist.

import { describe, expect, it, vi } from "vitest";
import type { FoodRow } from "@/lib/db/types";
import {
  finalizeWeek,
  loadWeek,
  resetWeek,
  searchSlot,
  startWeek,
  weekDates,
} from "@/lib/plans";
import type { RecipePage } from "@/lib/services/recipePage";
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

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

function mexicanWeek() {
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
      recipes: [
        recipe(1, "Eggs a la Mexicana", 380, 22),
        recipe(2, "Fiesta Chicken", 540, 42),
        recipe(3, "Beef Skillet", 690, 48),
        recipe(4, "Mango Yogurt Bowl", 260, 14),
        recipe(5, "Huevos Rancheros", 450, 20),
      ],
      plan_candidates: [
        ...SLOTS.map((slot, i) => ({
          id: i + 1,
          week_plan_id: 1,
          slot,
          recipe_id: i + 1,
          rank: 1,
          selected: true,
        })),
        {
          id: 9,
          week_plan_id: 1,
          slot: "breakfast",
          recipe_id: 5,
          rank: 2,
          selected: false,
        },
      ],
      shopping_list_items: [{ id: 1, week_plan_id: 1 }],
      // Last week's restaurant meal isn't part of this week.
      log_entries: [
        {
          id: 1,
          date: "2026-10-31",
          slot: "lunch",
          kind: "restaurant",
          status: "confirmed",
          plan_item_id: null,
        },
      ],
    },
  });
}

const TARGETS = { kcal: 3100, proteinG: 150 };

function chickenFood(): FoodRow {
  return {
    id: 1,
    user_id: "u1",
    name: "chicken breast",
    fdc_id: 1,
    kcal_100g: 120,
    protein_100g: 22.5,
    carbs_100g: 0,
    fat_100g: 0,
    fiber_100g: 0,
    sugar_100g: 0,
    sodium_mg_100g: 0,
    grams_per_unit: {},
    section: "pantry",
    created_at: "",
    updated_at: "",
  };
}

function chinesePages(): RecipePage[] {
  return Array.from({ length: 3 }, (_, i) => ({
    url: `https://c.test/kung-pao-${i}`,
    title: `Kung pao chicken ${i}`,
    photoUrl: null,
    servings: 2,
    cuisine: "Chinese",
    ingredients: [`${400 + i * 20} g chicken breast`],
    steps: ["Cook."],
    prepMinutes: 10,
    cookMinutes: 20,
    totalMinutes: 30,
    activeMinutes: 30,
  }));
}

describe("resetWeek", () => {
  it("clears a finalized week so a new cuisine can be shortlisted", async () => {
    const db = mexicanWeek();
    await finalizeWeek(db.client, 1, TARGETS);

    // Jadon ate Sunday's breakfast, skipped Monday's lunch and ate out for
    // Tuesday's dinner.
    const entries = db.table("log_entries");
    const [sunday, monday, tuesday] = weekDates("2026-11-01");
    entries.find((e) => e.date === sunday && e.slot === "breakfast")!.status =
      "confirmed";
    entries.find((e) => e.date === monday && e.slot === "lunch")!.status =
      "skipped";
    entries.push({
      id: 500,
      date: tuesday,
      slot: "dinner",
      kind: "restaurant",
      status: "confirmed",
      plan_item_id: null,
    });
    expect((await loadWeek(db.client, "2026-11-01"))!.loggedMeals).toBe(3);

    await resetWeek(db.client, 1);

    expect(await loadWeek(db.client, "2026-11-01")).toBeNull();
    expect(db.table("week_plans")).toHaveLength(0);
    expect(db.table("plan_candidates")).toHaveLength(0);
    expect(db.table("plan_items")).toHaveLength(0);
    expect(db.table("shopping_list_items")).toHaveLength(0);
    // Only the restaurant meals are left.
    expect(db.table("log_entries").map((e) => e.id)).toEqual([1, 500]);

    // A new week, Chinese this time, gets a fresh shortlist.
    const pages = chinesePages();
    const week = await startWeek(db.client, {
      weekStart: "2026-11-01",
      cuisines: ["Chinese"],
    });
    expect(week).toMatchObject({
      cuisines: ["Chinese"],
      status: "draft",
      loggedMeals: 1,
    });
    const result = await searchSlot({
      supabase: db.client,
      weekId: week.id,
      slot: "dinner",
      brave: { search: vi.fn(async () => pages.map((p) => p.url)) },
      readPage: vi.fn(
        async (url: string) => pages.find((p) => p.url === url) ?? null,
      ),
      lookup: vi.fn(async (name: string) =>
        name === "chicken breast" ? chickenFood() : null,
      ),
      wait: vi.fn(async () => {}),
    });
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.every((c) => c.recipe.cuisine === "Chinese")).toBe(
      true,
    );
  });

  it("clears a draft's shortlist and reports nothing logged", async () => {
    const db = mexicanWeek();
    expect((await loadWeek(db.client, "2026-11-01"))!.loggedMeals).toBe(0);
    await resetWeek(db.client, 1);
    expect(db.table("week_plans")).toHaveLength(0);
    expect(db.table("plan_candidates")).toHaveLength(0);
    expect(db.table("log_entries")).toHaveLength(1);
  });

  it("returns 404 for an unknown week", async () => {
    const db = mexicanWeek();
    await expect(resetWeek(db.client, 42)).rejects.toMatchObject({
      status: 404,
    });
  });
});
