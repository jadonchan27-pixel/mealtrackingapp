// Profile API shapes and validation (US-4). The API uses camelCase and US units;
// the database row uses snake_case.

import type { ActivityLevel, ProfileRow, Sex } from "@/lib/db/types";
import { ACTIVITY_MULTIPLIERS, type Targets } from "@/lib/targets";

export type Profile = {
  age: number;
  sex: Sex;
  heightIn: number;
  weightLb: number;
  activityLevel: ActivityLevel;
};

export const ACTIVITY_LEVELS = Object.keys(
  ACTIVITY_MULTIPLIERS,
) as ActivityLevel[];

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little or no exercise)",
  light: "Light (exercise 1–3 days a week)",
  moderate: "Moderate (exercise 3–5 days a week)",
  active: "Active (exercise 6–7 days a week)",
  very_active: "Very active (hard exercise daily or a physical job)",
};

// Sensible bounds that catch typos, not limits on real bodies.
export const LIMITS = {
  age: { min: 13, max: 120 },
  heightIn: { min: 36, max: 96 },
  weightLb: { min: 50, max: 1000 },
} as const;

export type ProfileErrors = Partial<Record<keyof Profile, string>>;

export type ParseResult =
  { ok: true; profile: Profile } | { ok: false; errors: ProfileErrors };

export function parseProfile(body: unknown): ParseResult {
  const input = (
    typeof body === "object" && body !== null ? body : {}
  ) as Record<string, unknown>;
  const errors: ProfileErrors = {};

  const age = input.age;
  if (
    typeof age !== "number" ||
    !Number.isInteger(age) ||
    age < LIMITS.age.min ||
    age > LIMITS.age.max
  ) {
    errors.age = `Age must be a whole number from ${LIMITS.age.min} to ${LIMITS.age.max}.`;
  }

  const sex = input.sex;
  if (sex !== "male" && sex !== "female") {
    errors.sex = "Choose male or female.";
  }

  const heightIn = input.heightIn;
  if (!inRange(heightIn, LIMITS.heightIn)) {
    errors.heightIn = "Height must be between 3 ft and 8 ft.";
  }

  const weightLb = input.weightLb;
  if (!inRange(weightLb, LIMITS.weightLb)) {
    errors.weightLb = `Weight must be from ${LIMITS.weightLb.min} to ${LIMITS.weightLb.max} lb.`;
  }

  const activityLevel = input.activityLevel;
  if (
    typeof activityLevel !== "string" ||
    !Object.hasOwn(ACTIVITY_MULTIPLIERS, activityLevel)
  ) {
    errors.activityLevel = "Choose an activity level.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    profile: {
      age: age as number,
      sex: sex as Sex,
      heightIn: heightIn as number,
      weightLb: weightLb as number,
      activityLevel: activityLevel as ActivityLevel,
    },
  };
}

function inRange(
  value: unknown,
  limits: { min: number; max: number },
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= limits.min &&
    value <= limits.max
  );
}

export function profileFromRow(row: ProfileRow): Profile {
  return {
    age: row.age,
    sex: row.sex,
    heightIn: Number(row.height_in),
    weightLb: Number(row.weight_lb),
    activityLevel: row.activity_level,
  };
}

export function profileToRow(
  profile: Profile,
): Pick<
  ProfileRow,
  "age" | "sex" | "height_in" | "weight_lb" | "activity_level"
> {
  return {
    age: profile.age,
    sex: profile.sex,
    height_in: profile.heightIn,
    weight_lb: profile.weightLb,
    activity_level: profile.activityLevel,
  };
}

// Whole numbers for display and the API.
export function roundTargets(targets: Targets): Targets {
  return {
    bmr: Math.round(targets.bmr),
    tdee: Math.round(targets.tdee),
    kcal: targets.kcal,
    proteinG: targets.proteinG,
    fatG: targets.fatG,
    carbsG: targets.carbsG,
  };
}
