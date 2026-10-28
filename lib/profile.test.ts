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
};

describe("parseProfile", () => {
  it("accepts a valid profile", () => {
    expect(parseProfile(valid)).toEqual({ ok: true, profile: valid });
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
    created_at: "2026-10-28T00:00:00Z",
    updated_at: "2026-10-28T00:00:00Z",
  };

  it("maps a row to the API shape and back", () => {
    const profile = profileFromRow(row);
    expect(profile).toEqual(valid);
    expect(profileToRow(profile)).toEqual({
      age: 25,
      sex: "male",
      height_in: 70,
      weight_lb: 160,
      activity_level: "moderate",
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
