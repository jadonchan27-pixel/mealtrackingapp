// Daily calorie and macro targets (TR-10, US-5). Computed on request, not stored.

import type { ActivityLevel, ProfileRow, Sex } from "@/lib/db/types";
import { inToCm, lbToKg } from "@/lib/units";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const DEFAULT_SURPLUS_KCAL = 300;
export const PROTEIN_G_PER_LB = 1;
export const FAT_SHARE = 0.25;

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export type TargetsInput = {
  age: number;
  sex: Sex;
  heightIn: number;
  weightLb: number;
  activityLevel: ActivityLevel;
  surplusKcal?: number;
};

export type Targets = {
  bmr: number;
  tdee: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

// Mifflin-St Jeor resting energy in kcal per day.
export function mifflinStJeorBmr(
  input: Pick<TargetsInput, "age" | "sex" | "heightIn" | "weightLb">,
): number {
  const kg = lbToKg(input.weightLb);
  const cm = inToCm(input.heightIn);
  const sexOffset = input.sex === "male" ? 5 : -161;
  return 10 * kg + 6.25 * cm - 5 * input.age + sexOffset;
}

export function computeTargets(input: TargetsInput): Targets {
  const bmr = mifflinStJeorBmr(input);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[input.activityLevel];
  const kcal = Math.round(tdee + (input.surplusKcal ?? DEFAULT_SURPLUS_KCAL));
  const proteinG = Math.round(input.weightLb * PROTEIN_G_PER_LB);
  const fatG = Math.round((kcal * FAT_SHARE) / KCAL_PER_G.fat);
  const remaining =
    kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = Math.max(0, Math.round(remaining / KCAL_PER_G.carbs));
  return { bmr, tdee, kcal, proteinG, fatG, carbsG };
}

export function targetsForProfile(
  profile: Pick<
    ProfileRow,
    | "age"
    | "sex"
    | "height_in"
    | "weight_lb"
    | "activity_level"
    | "surplus_kcal"
  >,
): Targets {
  return computeTargets({
    age: profile.age,
    sex: profile.sex,
    heightIn: profile.height_in,
    weightLb: profile.weight_lb,
    activityLevel: profile.activity_level,
    surplusKcal: profile.surplus_kcal,
  });
}
