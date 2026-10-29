// Build step 20g "done when": an own recipe added to a draft week's slot is
// that slot's selected candidate with the entered nutrition, and finalizing
// uses it.

import { describe, expect, it, vi } from "vitest";
import { addCustomRecipe, parseCustomRecipe } from "@/lib/customRecipe";
import type { FoodRow } from "@/lib/db/types";
import { finalizeWeek } from "@/lib/plans";
import { customSource, isCustomSource, recipeLink } from "@/lib/recipeSource";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

function food(id: number, name: string): FoodRow {
  return {
    id,
    user_id: "u1",
    name,
    fdc_id: 1,
    kcal_100g: 150,
    protein_100g: 20,
    carbs_100g: 5,
    fat_100g: 5,
    fiber_100g: 0,
    sugar_100g: 0,
    sodium_mg_100g: 0,
    grams_per_unit: {},
    section: "pantry",
    created_at: "",
    updated_at: "",
  };
}

const FOODS: Record<string, FoodRow> = {
  "chicken thighs": food(1, "chicken thighs"),
  rice: food(2, "rice"),
};
const lookup = vi.fn(async (name: string) => FOODS[name] ?? null);

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
    cost_cents_per_serving: 200,
  };
}

function draftWeek(status: "draft" | "final" = "draft") {
  return fakeRecipeTables({
    seed: {
      week_plans: [
        { id: 1, week_start: "2026-11-01", cuisines: ["Mexican"], status },
      ],
      recipes: [recipe(1, 400), recipe(2, 600)],
      foods: Object.values(FOODS),
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
      ],
    },
  });
}

const BODY = {
  slot: "lunch",
  title: "Mom's chicken and rice",
  servings: "4",
  kcal: "650",
  proteinG: "45",
  carbsG: "70",
  fatG: "18",
  ingredients: "2 lb chicken thighs\n2 cups rice\n\nsalt",
  steps: "Brown the chicken.\nAdd rice and water.",
  costPerServing: "",
};

describe("parseCustomRecipe", () => {
  it("reads the form's text fields", () => {
    const parsed = parseCustomRecipe({
      ...BODY,
      costPerServing: "2.35",
      activeMinutes: "25",
      sourceUrl: "https://mom.test/rice",
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        slot: "lunch",
        title: "Mom's chicken and rice",
        servings: 4,
        kcal: 650,
        proteinG: 45,
        carbsG: 70,
        fatG: 18,
        ingredients: ["2 lb chicken thighs", "2 cups rice", "salt"],
        steps: ["Brown the chicken.", "Add rice and water."],
        sourceUrl: "https://mom.test/rice",
        activeMinutes: 25,
        costCentsPerServing: 235,
      },
    });
  });

  it("needs a name, servings, calories and macros", () => {
    const parsed = parseCustomRecipe({ slot: "dinner", kcal: "0" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual([
      "carbsG",
      "fatG",
      "kcal",
      "proteinG",
      "servings",
      "slot",
      "title",
    ]);
  });

  it("rejects bad optional fields", () => {
    const parsed = parseCustomRecipe({
      ...BODY,
      sourceUrl: "javascript:alert(1)",
      activeMinutes: "2.5",
      costPerServing: "-1",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual([
      "activeMinutes",
      "costCentsPerServing",
      "sourceUrl",
    ]);
  });
});

describe("recipe sources", () => {
  it("keeps an own recipe's link apart from web recipes", () => {
    expect(customSource("a1", null)).toBe("custom:a1");
    expect(customSource("a1", "https://mom.test/x")).toBe(
      "custom:a1|https://mom.test/x",
    );
    expect(isCustomSource("custom:a1")).toBe(true);
    expect(isCustomSource("https://x.test/1")).toBe(false);
    expect(recipeLink("custom:a1")).toBeNull();
    expect(recipeLink("custom:a1|https://mom.test/x")).toBe(
      "https://mom.test/x",
    );
    expect(recipeLink("https://x.test/1")).toBe("https://x.test/1");
  });

  it("reads a cost typed with a dollar sign", () => {
    const parsed = parseCustomRecipe({ ...BODY, costPerServing: "$3" });
    expect(parsed.ok && parsed.value.costCentsPerServing).toBe(300);
  });
});

describe("addCustomRecipe", () => {
  it("makes the recipe the slot's pick with the entered nutrition", async () => {
    const db = draftWeek();
    const parsed = parseCustomRecipe(BODY);
    if (!parsed.ok) throw new Error("bad body");
    const { week } = await addCustomRecipe(
      db.client,
      1,
      parsed.value,
      lookup,
      () => "abc",
    );

    const lunch = week.candidates.lunch;
    expect(lunch.map((c) => [c.recipe.title, c.selected])).toEqual([
      ["Mom's chicken and rice", true],
      ["Recipe 2", false],
    ]);
    expect(lunch[0].recipe).toMatchObject({
      sourceUrl: "custom:abc",
      servings: 4,
      kcal: 650,
      proteinG: 45,
      carbsG: 70,
      fatG: 18,
      ingredients: ["2 lb chicken thighs", "2 cups rice", "salt"],
    });
    // Ingredients are matched to foods for the shopping list.
    const saved = db
      .recipes()
      .find((r) => r.title === "Mom's chicken and rice")!;
    const lines = db
      .table("recipe_ingredients")
      .filter((l) => l.recipe_id === saved.id);
    expect(lines.map((l) => l.food_id)).toEqual([1, 2, null]);
    // The other dish is untouched.
    expect(week.candidates.breakfast[0].selected).toBe(true);

    // Finalizing plans the own recipe as lunch and dinner.
    const final = await finalizeWeek(db.client, 1, {
      kcal: 2600,
      proteinG: 140,
    });
    expect(final.items.map((i) => [i.slot, i.recipe.title])).toEqual([
      ["breakfast", "Recipe 1"],
      ["lunch", "Mom's chicken and rice"],
    ]);
  });

  it("keeps an entered cost and a web recipe saved under the same link", async () => {
    const db = draftWeek();
    const parsed = parseCustomRecipe({
      ...BODY,
      costPerServing: "1.5",
      sourceUrl: "https://x.test/2",
    });
    if (!parsed.ok) throw new Error("bad body");
    const { week } = await addCustomRecipe(
      db.client,
      1,
      parsed.value,
      lookup,
      () => "xyz",
    );
    expect(week.candidates.lunch[0].recipe).toMatchObject({
      sourceUrl: "custom:xyz|https://x.test/2",
      costCentsPerServing: 150,
    });
    expect(db.recipes().find((r) => r.id === 2)?.title).toBe("Recipe 2");
  });

  it("saves the recipe with unmatched ingredients when USDA fails", async () => {
    const db = draftWeek();
    const parsed = parseCustomRecipe(BODY);
    if (!parsed.ok) throw new Error("bad body");
    const failing = vi.fn(async () => {
      throw new Error("USDA request failed: 503");
    });
    const { week } = await addCustomRecipe(db.client, 1, parsed.value, failing);
    expect(week.candidates.lunch[0].recipe).toMatchObject({
      title: "Mom's chicken and rice",
      kcal: 650,
    });
    const saved = db
      .recipes()
      .find((r) => r.title === "Mom's chicken and rice")!;
    expect(
      db
        .table("recipe_ingredients")
        .filter((l) => l.recipe_id === saved.id)
        .map((l) => l.food_id),
    ).toEqual([null, null, null]);
  });

  it("is added unpicked to a finalized week, for changeDish", async () => {
    const db = draftWeek("final");
    const parsed = parseCustomRecipe(BODY);
    if (!parsed.ok) throw new Error("bad body");
    const { week, candidateId } = await addCustomRecipe(
      db.client,
      1,
      parsed.value,
      lookup,
    );
    const added = week.candidates.lunch.find((c) => c.id === candidateId)!;
    expect(added).toMatchObject({ rank: 0, selected: false });
    expect(week.candidates.lunch.find((c) => c.selected)?.recipe.id).toBe(2);
  });
});
