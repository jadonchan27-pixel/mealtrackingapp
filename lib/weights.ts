// Weigh-in API validation (US-26).

import { LIMITS } from "@/lib/profile";

export type WeighInInput = { date: string; weightLb: number };

export type WeighInErrors = Partial<Record<keyof WeighInInput, string>>;

export type ParseWeighInResult =
  { ok: true; weighIn: WeighInInput } | { ok: false; errors: WeighInErrors };

// A real calendar date written as YYYY-MM-DD.
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function parseWeighIn(body: unknown): ParseWeighInResult {
  const input = (
    typeof body === "object" && body !== null ? body : {}
  ) as Record<string, unknown>;
  const errors: WeighInErrors = {};

  if (!isIsoDate(input.date)) {
    errors.date = "Choose a date.";
  }
  const weightLb = input.weightLb;
  if (
    typeof weightLb !== "number" ||
    !Number.isFinite(weightLb) ||
    weightLb < LIMITS.weightLb.min ||
    weightLb > LIMITS.weightLb.max
  ) {
    errors.weightLb = `Weight must be from ${LIMITS.weightLb.min} to ${LIMITS.weightLb.max} lb.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    weighIn: { date: input.date as string, weightLb: weightLb as number },
  };
}
