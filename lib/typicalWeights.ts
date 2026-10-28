// Typical weights (TR-8) for when a food's USDA record has no portion for the
// unit a recipe uses: USDA Foundation foods often list only grams, so "1 cup
// uncooked rice" or "8 corn tortillas" would otherwise drop out of the
// nutrition. Values are rounded USDA SR Legacy household measures.

import { isVolumeUnit, toMl } from "@/lib/units";

// Grams in one cup, by words in the food name. More specific entries first.
const GRAMS_PER_CUP: [string, number][] = [
  ["broth", 240],
  ["stock", 240],
  ["milk", 245],
  ["juice", 245],
  ["vinegar", 240],
  ["wine", 240],
  ["instant rice", 95],
  ["instant brown rice", 95],
  ["brown rice", 190],
  ["rice", 185],
  ["quinoa", 170],
  ["rolled oats", 81],
  ["oats", 81],
  ["flour", 125],
  ["brown sugar", 220],
  ["sugar", 200],
  ["cornmeal", 157],
  ["lentils", 192],
  ["chia seeds", 192],
  ["seeds", 140],
  ["nuts", 140],
  ["shredded cheese", 113],
  ["corn", 145],
  ["peas", 145],
];

// Grams in one whole item, by words in the food name.
const GRAMS_PER_PIECE: [string, number][] = [
  ["corn tortillas", 26],
  ["flour tortillas", 45],
  ["tortillas", 30],
  ["sweet potatoes", 130],
  ["potatoes", 213],
  ["bell peppers", 119],
  ["jalapenos", 14],
  ["mangoes", 336],
  ["mangos", 336],
  ["mango", 336],
  ["avocados", 150],
  ["bananas", 118],
  ["apples", 182],
  ["limes", 67],
  ["lemons", 84],
  ["oranges", 131],
  ["eggs", 50],
  ["green onions", 15],
  ["scallions", 15],
  ["onions", 110],
  ["cherry tomatoes", 17],
  ["grape tomatoes", 8],
  ["tomatoes", 123],
  ["carrots", 61],
  ["zucchini", 196],
  ["cucumbers", 301],
  ["chicken breasts", 174],
  ["chicken thighs", 116],
  ["pitas", 60],
  ["bagels", 105],
];

// A can with no size given: the common 15 oz can.
export const DEFAULT_CAN_GRAMS = 425;

function singular(word: string): string {
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w !== "")
    .map(singular);
}

// The first entry all of whose words are in the food name ("brown rice"
// matches "instant brown rice", "rice" matches "long grain white rice").
function find(table: [string, number][], foodText: string): number | null {
  const have = words(foodText);
  for (const [key, grams] of table) {
    if (words(key).every((w) => have.includes(w))) return grams;
  }
  return null;
}

// Grams in one `unit` of the food when its own record has no weight for it.
export function typicalGrams(
  unit: string | null,
  foodText: string,
): number | null {
  if (unit === "can") return DEFAULT_CAN_GRAMS;
  if (unit !== null && isVolumeUnit(unit)) {
    const perCup = find(GRAMS_PER_CUP, foodText);
    if (perCup === null || unit === "cup") return perCup;
    return (perCup * toMl(1, unit)) / toMl(1, "cup");
  }
  if (unit === null) return find(GRAMS_PER_PIECE, foodText);
  return null;
}

// Plain water adds no nutrition, and USDA's "water" matches are other drinks.
export function isPlainWater(foodText: string): boolean {
  return /^(?:(?:cold|cool|warm|hot|boiling|ice|iced|filtered|tap|lukewarm)\s+)?water$/i.test(
    foodText.trim(),
  );
}
