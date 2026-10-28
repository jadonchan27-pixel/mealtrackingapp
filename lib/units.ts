// Unit conversions. The UI uses US units; formulas and nutrition use metric.

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const IN_PER_FT = 12;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function ftInToIn(feet: number, inches: number): number {
  return feet * IN_PER_FT + inches;
}

// Total inches to whole feet plus remaining inches, e.g. 70 -> { feet: 5, inches: 10 }.
export function inToFtIn(totalInches: number): {
  feet: number;
  inches: number;
} {
  const feet = Math.floor(totalInches / IN_PER_FT);
  return { feet, inches: totalInches - feet * IN_PER_FT };
}

// Cooking units. Volume converts through millilitres, mass through grams.
// Converting between volume and mass needs the food's density, so it isn't done here.

const ML_PER_UNIT = {
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  fl_oz: 29.5735295625,
  cup: 236.5882365,
  pint: 473.176473,
  quart: 946.352946,
  gallon: 3785.411784,
  ml: 1,
  l: 1000,
} as const;

const G_PER_UNIT = {
  oz: 28.349523125,
  lb: 453.59237,
  g: 1,
  kg: 1000,
} as const;

export type VolumeUnit = keyof typeof ML_PER_UNIT;
export type MassUnit = keyof typeof G_PER_UNIT;
export type CookingUnit = VolumeUnit | MassUnit;

export function isVolumeUnit(unit: string): unit is VolumeUnit {
  return Object.hasOwn(ML_PER_UNIT, unit);
}

export function isMassUnit(unit: string): unit is MassUnit {
  return Object.hasOwn(G_PER_UNIT, unit);
}

export function toMl(value: number, unit: VolumeUnit): number {
  return value * ML_PER_UNIT[unit];
}

export function toGrams(value: number, unit: MassUnit): number {
  return value * G_PER_UNIT[unit];
}

export function convertCooking(
  value: number,
  from: CookingUnit,
  to: CookingUnit,
): number {
  if (isVolumeUnit(from) && isVolumeUnit(to)) {
    return toMl(value, from) / ML_PER_UNIT[to];
  }
  if (isMassUnit(from) && isMassUnit(to)) {
    return toGrams(value, from) / G_PER_UNIT[to];
  }
  throw new Error(`Can't convert ${from} to ${to} without the food's density`);
}
