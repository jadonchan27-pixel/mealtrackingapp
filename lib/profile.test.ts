import { describe, expect, it } from "vitest";
import type { ProfileRow } from "@/lib/db/types";
import { computeTargets } from "@/lib/targets";
import {
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  parseProfile,
  profileFromRow,
  profileToRow,
  roundTargets,
} from "./profile";

const valid = {
  age: 25,
  sex: "male",
  heightIn: 70,
  weightLb: 160,
  activityLevel: "moderate",
  minIngredients: null,
  maxIngredients: null,
  maxMealCost: null,
  weeklyBudget: null,
};

describe("parseProfile", () => {
  it("accepts a valid profile", () => {
    expect(parseProfile(valid)).toEqual({ ok: true, profile: valid });
  });

  it("takes an optional ingredient range", () => {
    expect(
      parseProfile({ ...valid, minIngredients: 3, maxIngredients: 5 }),
    ).toEqual({
      ok: true,
      profile: { ...valid, minIngredients: 3, maxIngredients: 5 },
    });
    expect(parseProfile({ ...valid, maxIngredients: 8 })).toMatchObject({
      ok: true,
      profile: { minIngredients: null, maxIngredients: 8 },
    });
  });

  it("takes optional price limits in whole dollars", () => {
    expect(
      parseProfile({ ...valid, maxMealCost: 4, weeklyBudget: 80 }),
    ).toEqual({
      ok: true,
      profile: { ...valid, maxMealCost: 4, weeklyBudget: 80 },
    });
  });

  it("accepts fractional height and weight", () => {
    const result = parseProfile({ ...valid, heightIn: 69.5, weightLb: 160.4 });
    expect(result.ok).toBe(true);
  });

  it("drops fields it doesn't know", () => {
    const result = parseProfile({ ...valid, surplusKcal: 1000, user_id: "x" });
    expect(result).toEqual({ ok: true, profile: valid });
  });

  it.each([
    ["age", { age: 25.5 }],
    ["age", { age: 12 }],
    ["age", { age: "25" }],
    ["sex", { sex: "other" }],
    ["heightIn", { heightIn: 20 }],
    ["heightIn", { heightIn: Number.NaN }],
    ["weightLb", { weightLb: 0 }],
    ["weightLb", { weightLb: 2000 }],
    ["activityLevel", { activityLevel: "extreme" }],
    ["activityLevel", { activityLevel: "toString" }],
    ["minIngredients", { minIngredients: 0 }],
    ["maxIngredients", { maxIngredients: 3.5 }],
    ["maxIngredients", { minIngredients: 6, maxIngredients: 4 }],
    ["maxMealCost", { maxMealCost: 0 }],
    ["maxMealCost", { maxMealCost: 4.5 }],
    ["weeklyBudget", { weeklyBudget: 1001 }],
    ["weeklyBudget", { weeklyBudget: "80" }],
  ])("rejects a bad %s: %o", (field, change) => {
    const result = parseProfile({ ...valid, ...change });
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors)).toEqual([field]);
  });

  it("reports every missing field", () => {
    for (const body of [null, "x", {}]) {
      const result = parseProfile(body);
      expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
        "activityLevel",
        "age",
        "heightIn",
        "sex",
        "weightLb",
      ]);
    }
  });
});

describe("row mapping", () => {
  const row: ProfileRow = {
    user_id: "u1",
    age: 25,
    sex: "male",
    height_in: 70,
    weight_lb: 160,
    activity_level: "moderate",
    surplus_kcal: 300,
    min_ingredients: null,
    max_ingredients: null,
    max_cost_cents_per_meal: 400,
    weekly_budget_cents: null,
    created_at: "2026-10-28T00:00:00Z",
    updated_at: "2026-10-28T00:00:00Z",
  };

  it("maps a row to the API shape and back", () => {
    const profile = profileFromRow(row);
    expect(profile).toEqual({ ...valid, maxMealCost: 4 });
    expect(profileToRow(profile)).toEqual({
      age: 25,
      sex: "male",
      height_in: 70,
      weight_lb: 160,
      activity_level: "moderate",
      min_ingredients: null,
      max_ingredients: null,
      max_cost_cents_per_meal: 400,
      weekly_budget_cents: null,
    });
  });
});

describe("roundTargets", () => {
  it("rounds BMR and maintenance calories", () => {
    const t = roundTargets(
      computeTargets({ ...valid, sex: "male", activityLevel: "sedentary" }),
    );
    expect(t).toEqual({
      bmr: 1717,
      tdee: 2060,
      kcal: 2360,
      proteinG: 160,
      fatG: 66,
      carbsG: 282,
    });
  });
});

describe("activity levels", () => {
  it("labels every level", () => {
    expect(ACTIVITY_LEVELS).toEqual([
      "sedentary",
      "light",
      "moderate",
      "active",
      "very_active",
    ]);
    for (const level of ACTIVITY_LEVELS) {
      expect(ACTIVITY_LABELS[level]).toBeTruthy();
    }
  });
});
