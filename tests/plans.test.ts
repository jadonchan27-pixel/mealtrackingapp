// Build step 12 "done when": Jadon can build a full shortlist and pick one
// recipe per slot. Brave, the recipe pages and USDA are faked here; the live
// check runs on Jadon's PC.

import { describe, expect, it, vi } from "vitest";
import type { FoodRow } from "@/lib/db/types";
import {
  loadRecipe,
  loadWeek,
  PlanError,
  searchSlot,
  selectCandidate,
  startWeek,
} from "@/lib/plans";
import type { RecipePage } from "@/lib/services/recipePage";
import { MEAL_SLOTS } from "@/lib/weeks";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function food(id: number, name: string, kcal: number, protein: number) {
  return {
    id,
    user_id: "u1",
    name,
    fdc_id: id,
    kcal_100g: kcal,
    protein_100g: protein,
    carbs_100g: 0,
    fat_100g: 0,
    fiber_100g: 0,
    sugar_100g: 0,
    sodium_mg_100g: 0,
    grams_per_unit: {},
    section: "pantry",
    created_at: "",
    updated_at: "",
  } satisfies FoodRow;
}

const FOODS: Record<string, FoodRow> = {
  "chicken breast": food(1, "chicken breast", 120, 22.5),
  rice: food(2, "rice", 130, 2.7),
  paneer: food(3, "paneer", 320, 20),
  lentils: food(4, "lentils", 116, 9),
  eggs: food(5, "eggs", 143, 12.6),
};

function page(url: string, title: string, ingredients: string[]): RecipePage {
  return {
    url,
    title,
    photoUrl: `${url}.jpg`,
    servings: 2,
    cuisine: "Indian",
    ingredients,
    steps: ["Prep.", "Cook."],
    prepMinutes: 10,
    cookMinutes: 20,
    totalMinutes: 30,
    activeMinutes: 30,
  };
}

const PAGES: RecipePage[] = [
  page("https://a.test/tandoori", "Tandoori chicken", [
    "500 g chicken breast",
    "200 g rice",
  ]),
  page("https://b.test/paneer", "Paneer bowl", ["300 g paneer", "200 g rice"]),
  page("https://c.test/dal", "Dal", ["400 g lentils", "200 g rice"]),
  page("https://d.test/bhurji", "Egg bhurji", ["300 g eggs"]),
];

// Enough recipes for four slots of 3 with none shared.
const MANY_PAGES: RecipePage[] = [
  ...PAGES,
  ...Array.from({ length: 8 }, (_, i) =>
    page(`https://e.test/curry-${i}`, `Chicken curry ${i}`, [
      `${300 + i * 20} g chicken breast`,
      "150 g rice",
    ]),
  ),
];

function fakes(pages = PAGES) {
  return {
    brave: { search: vi.fn(async () => pages.map((p) => p.url)) },
    readPage: vi.fn(
      async (url: string) => pages.find((p) => p.url === url) ?? null,
    ),
    lookup: vi.fn(async (name: string) => FOODS[name] ?? null),
    wait: vi.fn(async () => {}),
  };
}

describe("startWeek", () => {
  it("starts the week with the chosen cuisines", async () => {
    const db = fakeRecipeTables();
    const week = await startWeek(db.client, {
      weekStart: "2026-11-01",
      cuisines: ["Indian"],
    });
    expect(week).toMatchObject({
      weekStart: "2026-11-01",
      cuisines: ["Indian"],
      status: "draft",
    });
    expect(week.candidates).toEqual({
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    });
  });

  it("picks a cuisine not used last week when none is chosen", async () => {
    const db = fakeRecipeTables({
      seed: {
        week_plans: [
          { id: 1, week_start: "2026-10-25", cuisines: ["American"] },
        ],
      },
    });
    // 0 picks the first option still available; American is first overall.
    const week = await startWeek(
      db.client,
      { weekStart: "2026-11-01", cuisines: [] },
      () => 0,
    );
    expect(week.cuisines).toEqual(["Mexican"]);
  });

  it("changes the cuisines of a draft, but not of a finalized week", async () => {
    const db = fakeRecipeTables({
      seed: {
        week_plans: [
          {
            id: 1,
            week_start: "2026-11-01",
            cuisines: ["Thai"],
            status: "draft",
          },
          {
            id: 2,
            week_start: "2026-11-08",
            cuisines: ["Thai"],
            status: "final",
          },
        ],
      },
    });
    const week = await startWeek(db.client, {
      weekStart: "2026-11-01",
      cuisines: ["Greek"],
    });
    expect(week).toMatchObject({ id: 1, cuisines: ["Greek"] });
    expect(db.table("week_plans")).toHaveLength(2);

    await expect(
      startWeek(db.client, { weekStart: "2026-11-08", cuisines: ["Greek"] }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("searchSlot and selectCandidate", () => {
  it("builds a full shortlist and picks one recipe per slot", async () => {
    const db = fakeRecipeTables();
    const { brave, readPage, lookup, wait } = fakes(MANY_PAGES);
    const week = await startWeek(db.client, {
      weekStart: "2026-11-01",
      cuisines: ["Indian"],
    });

    for (const slot of MEAL_SLOTS) {
      const result = await searchSlot({
        supabase: db.client,
        weekId: week.id,
        slot,
        brave,
        lookup,
        readPage,
        wait,
      });
      expect(result.candidates).toHaveLength(3);
      expect(result.candidates[0]).toMatchObject({ rank: 1, selected: true });
      expect(result.candidates.slice(1).every((c) => !c.selected)).toBe(true);
    }

    const shortlist = (await loadWeek(db.client, "2026-11-01"))!;
    const picked = MEAL_SLOTS.map(
      (slot) => shortlist.candidates[slot].filter((c) => c.selected).length,
    );
    expect(picked).toEqual([1, 1, 1, 1]);

    // No recipe is shortlisted for two meals.
    const shortlisted = MEAL_SLOTS.flatMap((slot) =>
      shortlist.candidates[slot].map((c) => c.recipe.id),
    );
    expect(new Set(shortlisted).size).toBe(12);

    // Each candidate carries what the card shows.
    expect(shortlist.candidates.breakfast[0].recipe).toMatchObject({
      photoUrl: expect.stringMatching(/\.jpg$/),
      activeMinutes: 30,
      kcal: expect.any(Number),
      proteinG: expect.any(Number),
      ingredients: expect.arrayContaining([expect.stringMatching(/ g /)]),
    });

    // Swapping selects the new pick and unselects the old one.
    const [first, second] = shortlist.candidates.breakfast;
    const swapped = await selectCandidate(db.client, second.id);
    expect(swapped.map((c) => [c.id, c.selected])).toEqual([
      [first.id, false],
      [second.id, true],
      [shortlist.candidates.breakfast[2].id, false],
    ]);
    // Other slots keep their picks.
    const after = (await loadWeek(db.client, "2026-11-01"))!;
    expect(after.candidates.lunch.filter((c) => c.selected)).toHaveLength(1);
  });

  it("re-running a slot replaces its candidates and leaves out last week's recipes", async () => {
    const db = fakeRecipeTables({
      seed: {
        week_plans: [{ id: 1, week_start: "2026-10-25", cuisines: ["Indian"] }],
      },
    });
    const { brave, readPage, lookup, wait } = fakes();
    const week = await startWeek(db.client, {
      weekStart: "2026-11-01",
      cuisines: ["Indian"],
    });
    const args = {
      supabase: db.client,
      weekId: week.id,
      slot: "dinner" as const,
      brave,
      lookup,
      readPage,
      wait,
    };
    const first = await searchSlot(args);
    const lastWeekPick = first.candidates[0].recipe.id;
    db.table("plan_items").push({
      id: 1,
      week_plan_id: 1,
      slot: "dinner",
      recipe_id: lastWeekPick,
    });

    const again = await searchSlot(args);
    expect(again.candidates.map((c) => c.recipe.id)).not.toContain(
      lastWeekPick,
    );
    expect(
      db.table("plan_candidates").filter((c) => c.slot === "dinner"),
    ).toHaveLength(3);
    expect(again.pagesRead).toBe(4);
  });

  it("refuses to change a finalized week or an unknown candidate", async () => {
    const db = fakeRecipeTables({
      seed: {
        week_plans: [{ id: 7, week_start: "2026-11-01", status: "final" }],
        plan_candidates: [
          { id: 9, week_plan_id: 7, slot: "lunch", recipe_id: 1, rank: 1 },
        ],
      },
    });
    const { brave, readPage, lookup, wait } = fakes();
    await expect(
      searchSlot({
        supabase: db.client,
        weekId: 7,
        slot: "lunch",
        brave,
        lookup,
        readPage,
        wait,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(selectCandidate(db.client, 9)).rejects.toMatchObject({
      status: 409,
    });
    await expect(selectCandidate(db.client, 99)).rejects.toBeInstanceOf(
      PlanError,
    );
    await expect(
      searchSlot({
        supabase: db.client,
        weekId: 8,
        slot: "lunch",
        brave,
        lookup,
        readPage,
        wait,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("selectCandidate", () => {
  it("won't pick a recipe already picked for another meal", async () => {
    const db = fakeRecipeTables({
      seed: {
        week_plans: [{ id: 1, week_start: "2026-11-01", status: "draft" }],
        plan_candidates: [
          {
            id: 1,
            week_plan_id: 1,
            slot: "snack",
            recipe_id: 5,
            rank: 1,
            selected: true,
          },
          {
            id: 2,
            week_plan_id: 1,
            slot: "breakfast",
            recipe_id: 6,
            rank: 1,
            selected: true,
          },
          {
            id: 3,
            week_plan_id: 1,
            slot: "breakfast",
            recipe_id: 5,
            rank: 2,
            selected: false,
          },
        ],
      },
    });
    await expect(selectCandidate(db.client, 3)).rejects.toMatchObject({
      status: 409,
      message: "This recipe is already picked for snack",
    });
    expect(db.table("plan_candidates").map((c) => [c.id, c.selected])).toEqual([
      [1, true],
      [2, true],
      [3, false],
    ]);
  });
});

describe("loadRecipe", () => {
  it("returns the recipe with its ingredients and steps", async () => {
    const db = fakeRecipeTables({
      seed: {
        recipes: [
          {
            id: 3,
            title: "Dal",
            source_url: "https://c.test/dal",
            photo_url: null,
            cuisine: "Indian",
            servings: 2,
            active_minutes: 30,
            steps: ["Rinse.", "Simmer."],
            kcal: 362,
            protein_g: 20.7,
            carbs_g: 0,
            fat_g: 0,
            fiber_g: 0,
            sugar_g: 0,
            sodium_mg: 0,
            cost_cents_per_serving: null,
          },
        ],
        recipe_ingredients: [
          { id: 2, recipe_id: 3, raw_text: "200 g rice", grams: 200 },
          { id: 1, recipe_id: 3, raw_text: "400 g lentils", grams: 400 },
          { id: 3, recipe_id: 3, raw_text: "salt to taste", grams: null },
        ],
      },
    });
    expect(await loadRecipe(db.client, 3)).toMatchObject({
      title: "Dal",
      kcal: 362,
      steps: ["Rinse.", "Simmer."],
      ingredients: [
        { text: "400 g lentils", grams: 400 },
        { text: "200 g rice", grams: 200 },
        { text: "salt to taste", grams: null },
      ],
    });
    expect(await loadRecipe(db.client, 4)).toBeNull();
  });
});
