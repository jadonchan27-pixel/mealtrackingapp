import { describe, expect, it } from "vitest";
import type { ActivityLevel } from "@/lib/db/types";
import { computeTargets, mifflinStJeorBmr, targetsForProfile } from "./targets";

// Worked examples, calculated by hand from the Mifflin-St Jeor formula:
// male 25 y, 5 ft 10 in (177.8 cm), 160 lb (72.575 kg):
//   BMR = 10 × 72.575 + 6.25 × 177.8 − 5 × 25 + 5 = 1717.0
// female 30 y, 5 ft 4 in (162.56 cm), 130 lb (58.967 kg):
//   BMR = 10 × 58.967 + 6.25 × 162.56 − 5 × 30 − 161 = 1294.67
// kcal = round(BMR × activity + 300); protein = 1 g/lb;
// fat = round(kcal × 0.25 / 9); carbs = round((kcal − 4·protein − 9·fat) / 4),
// with halves rounded up.
const male = { age: 25, sex: "male", heightIn: 70, weightLb: 160 } as const;
const female = { age: 30, sex: "female", heightIn: 64, weightLb: 130 } as const;

type Row = [ActivityLevel, number, number, number, number, number];

const maleRows: Row[] = [
  // level, tdee, kcal, protein, fat, carbs
  ["sedentary", 2060.4, 2360, 160, 66, 282],
  ["light", 2360.87, 2661, 160, 74, 339],
  ["moderate", 2661.35, 2961, 160, 82, 396],
  ["active", 2961.82, 3262, 160, 91, 451],
  ["very_active", 3262.3, 3562, 160, 99, 508],
];

const femaleRows: Row[] = [
  ["sedentary", 1553.6, 1854, 130, 52, 217],
  ["light", 1780.17, 2080, 130, 58, 260],
  ["moderate", 2006.74, 2307, 130, 64, 303],
  ["active", 2233.31, 2533, 130, 70, 346],
  ["very_active", 2459.87, 2760, 130, 77, 387],
];

describe("mifflinStJeorBmr", () => {
  it("matches the worked examples", () => {
    expect(mifflinStJeorBmr(male)).toBeCloseTo(1717.0, 2);
    expect(mifflinStJeorBmr(female)).toBeCloseTo(1294.67, 2);
  });

  it("differs by 166 kcal between sexes with the same body", () => {
    expect(
      mifflinStJeorBmr({ ...male, sex: "male" }) -
        mifflinStJeorBmr({ ...male, sex: "female" }),
    ).toBeCloseTo(166, 10);
  });
});

describe.each([
  ["male", male, maleRows],
  ["female", female, femaleRows],
] as const)("computeTargets (%s)", (_, body, rows) => {
  it.each(rows)(
    "%s: tdee %d, %d kcal, %d g protein, %d g fat, %d g carbs",
    (activityLevel, tdee, kcal, proteinG, fatG, carbsG) => {
      const t = computeTargets({ ...body, activityLevel });
      expect(t.tdee).toBeCloseTo(tdee, 2);
      expect(t).toMatchObject({ kcal, proteinG, fatG, carbsG });
    },
  );
});

describe("computeTargets", () => {
  it("adds 300 kcal by default and honours a custom surplus", () => {
    const base = computeTargets({ ...male, activityLevel: "moderate" });
    const none = computeTargets({
      ...male,
      activityLevel: "moderate",
      surplusKcal: 0,
    });
    expect(base.kcal - none.kcal).toBe(300);
    expect(none.kcal).toBe(Math.round(none.tdee));
  });

  it("keeps macro calories within rounding of the calorie target", () => {
    for (const [activityLevel] of [...maleRows, ...femaleRows]) {
      for (const body of [male, female]) {
        const t = computeTargets({ ...body, activityLevel });
        const macroKcal = 4 * t.proteinG + 4 * t.carbsG + 9 * t.fatG;
        expect(Math.abs(macroKcal - t.kcal)).toBeLessThanOrEqual(2);
      }
    }
  });

  it("never returns negative carbs", () => {
    // Only reachable with a large deficit, where protein and fat alone exceed the calories.
    const t = computeTargets({
      ...male,
      activityLevel: "sedentary",
      surplusKcal: -1500,
    });
    expect(t.kcal).toBe(560);
    expect(t.carbsG).toBe(0);
  });
});

describe("targetsForProfile", () => {
  it("reads the profile row's columns", () => {
    const t = targetsForProfile({
      age: 25,
      sex: "male",
      height_in: 70,
      weight_lb: 160,
      activity_level: "sedentary",
      surplus_kcal: 300,
    });
    expect(t.kcal).toBe(2360);
  });
});
