// Ingredient count (US-28, TR-22): how many ingredients a recipe needs,
// leaving out pantry staples and optional lines, to compare with the range
// set on the profile.

import { parseIngredient } from "@/lib/ingredients/parse";
import { isPlainWater } from "@/lib/typicalWeights";

const STAPLES = [
  // salt, kosher salt, sea salt
  /^(?:(?:kosher|sea|fine|coarse|table|flaky)\s+)*salt$/,
  // pepper, black pepper, freshly ground black pepper
  /^(?:(?:freshly|fresh|cracked|ground)\s+)*(?:black\s+)?pepper(?:corns)?$/,
  // salt and pepper, salt & freshly ground black pepper
  /^(?:\w+\s+)*salt\s+(?:and|&)\s+(?:(?:freshly|fresh|cracked|ground)\s+)*(?:black\s+)?pepper$/,
  // oil, olive oil, extra virgin olive oil, vegetable oil
  /^(?:(?:extra[-\s]virgin|light|mild|neutral|cooking)\s+)*(?:(?:olive|vegetable|canola|avocado|coconut|sunflower|grapeseed|peanut)\s+)?oil$/,
  // cooking spray, nonstick spray, olive oil spray
  /^(?:\w+\s+)*(?:cooking|nonstick|non-stick|oil)\s+spray$/,
];

function normalize(food: string): string {
  return food
    .toLowerCase()
    .replace(/[^a-z&\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPantryStaple(food: string): boolean {
  const name = normalize(food);
  return isPlainWater(name) || STAPLES.some((re) => re.test(name));
}

function isOptional(text: string | null): boolean {
  return text !== null && /\boptional\b/i.test(text);
}

// Lines with a food that's needed and isn't a pantry staple. Headings
// ("For the sauce:") and lines marked optional don't count.
export function countIngredients(lines: readonly string[]): number {
  let count = 0;
  for (const line of lines) {
    const parsed = parseIngredient(line);
    if (parsed.status !== "parsed") continue;
    if (isOptional(parsed.note) || isOptional(parsed.food)) continue;
    if (isPantryStaple(parsed.food)) continue;
    count++;
  }
  return count;
}

export type IngredientRange = { min: number | null; max: number | null };

export function inIngredientRange(
  count: number,
  { min, max }: IngredientRange,
): boolean {
  return (min === null || count >= min) && (max === null || count <= max);
}
