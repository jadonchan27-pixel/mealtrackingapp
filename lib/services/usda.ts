// USDA FoodData Central client (TR-8): search a food, then read its nutrition per
// 100 g and its portion weights. https://fdc.nal.usda.gov/api-guide
// Foundation and SR Legacy foods are used because they report nutrients per 100 g.

import { normalizeUnit } from "@/lib/ingredients/parse";

const BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const DATA_TYPES = ["Foundation", "SR Legacy"];

export type Per100g = {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
};

export type UsdaFood = {
  fdcId: number;
  description: string;
  per100g: Per100g;
  // Grams in one unit, keyed by canonical unit ("cup", "tbsp", "slice") or by a
  // size word for whole items ("large", "medium", "each").
  gramsPerUnit: Record<string, number>;
};

// FoodData Central nutrient ids. Energy has an Atwater variant in Foundation foods.
const NUTRIENTS: Record<keyof Per100g, number[]> = {
  kcal: [1008, 2047, 2048],
  proteinG: [1003],
  carbsG: [1005],
  fatG: [1004],
  fiberG: [1079],
  sugarG: [2000, 1063],
  sodiumMg: [1093],
};

export type UsdaClientOptions = {
  apiKey?: string;
  fetch?: typeof fetch;
};

export class UsdaError extends Error {}

export function usdaApiKey(): string {
  const key = process.env.USDA_API_KEY;
  if (!key) {
    throw new UsdaError(
      "Missing environment variable USDA_API_KEY. See .env.example.",
    );
  }
  return key;
}

export function createUsdaClient(options: UsdaClientOptions = {}) {
  const doFetch = options.fetch ?? fetch;
  const apiKey = () => options.apiKey ?? usdaApiKey();

  async function get(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("api_key", apiKey());
    const res = await doFetch(url);
    if (!res.ok) {
      throw new UsdaError(
        `USDA request failed: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as unknown;
  }

  // The best matching food's id, or null when USDA has nothing for the name.
  // USDA's own first result is often a part or a variety ("egg white" for
  // "eggs"), so the top results are scored by bestMatch instead.
  async function search(
    query: string,
    dataTypes: readonly string[] = DATA_TYPES,
  ): Promise<number | null> {
    return (await searchRanked(query, dataTypes))[0]?.fdcId ?? null;
  }

  // Every result, best match first.
  async function searchRanked(
    query: string,
    dataTypes: readonly string[],
  ): Promise<SearchResult[]> {
    const json = (await get("/foods/search", {
      query,
      dataType: dataTypes.join(","),
      pageSize: "25",
    })) as { foods?: SearchResult[] };
    return rankMatches(query, json.foods ?? []);
  }

  async function getFood(fdcId: number): Promise<UsdaFood> {
    return toUsdaFood((await get(`/food/${fdcId}`)) as FoodDetails);
  }

  // Foundation foods often list no whole-item portions, so "2 large eggs" or
  // "1 onion" couldn't be weighed. Then the missing portions come from SR
  // Legacy: the best few matches for the line, then for its last word
  // ("onion" for "yellow onion"), until one weighs a whole item. The food's
  // own portions win where both have one.
  async function findFood(query: string): Promise<UsdaFood | null> {
    const fdcId = await search(query);
    if (fdcId === null) return null;
    const food = await getFood(fdcId);
    if (hasWholeItemSize(food)) return food;

    const tried = new Set([fdcId]);
    let fallback: UsdaFood | null = null;
    let fetches = 0;
    for (const q of legacyQueries(query)) {
      const head = headNoun(q);
      for (const result of await searchRanked(q, ["SR Legacy"])) {
        if (fetches >= MAX_LEGACY_FETCHES) break;
        if (tried.has(result.fdcId)) continue;
        if (words(result.description)[0] !== head) continue;
        tried.add(result.fdcId);
        fetches++;
        const legacy = await getFood(result.fdcId);
        fallback ??= legacy;
        if (hasWholeItemSize(legacy)) {
          return withPortionsFrom(food, legacy);
        }
      }
    }
    return fallback === null ? food : withPortionsFrom(food, fallback);
  }

  return { search, getFood, findFood };
}

export type UsdaClient = ReturnType<typeof createUsdaClient>;

// SR Legacy foods fetched at most when borrowing whole-item sizes.
const MAX_LEGACY_FETCHES = 4;

function hasWholeItemSize(food: UsdaFood): boolean {
  return WHOLE_ITEM_SIZES.some((k) => food.gramsPerUnit[k] !== undefined);
}

function withPortionsFrom(food: UsdaFood, legacy: UsdaFood): UsdaFood {
  return {
    ...food,
    gramsPerUnit: { ...legacy.gramsPerUnit, ...food.gramsPerUnit },
  };
}

function wantedWords(query: string): string[] {
  const wanted = words(query).filter((w) => !IGNORED_QUERY_WORDS.has(w));
  return wanted.length > 0 ? wanted : words(query);
}

// The word that names the food: the last one ("onion" in "yellow onion").
function headNoun(query: string): string {
  return wantedWords(query).at(-1) ?? "";
}

// The line itself, then its head noun when that's different.
function legacyQueries(query: string): string[] {
  const head = headNoun(query);
  return wantedWords(query).length > 1 && head !== "" ? [query, head] : [query];
}

// The parts of a /food/{id} response that are used.
export type FoodDetails = {
  fdcId: number;
  description: string;
  foodNutrients?: {
    nutrient?: { id?: number };
    amount?: number;
  }[];
  foodPortions?: {
    gramWeight?: number;
    amount?: number;
    modifier?: string;
    portionDescription?: string;
    measureUnit?: { name?: string; abbreviation?: string };
  }[];
};

export function toUsdaFood(details: FoodDetails): UsdaFood {
  const amounts = new Map<number, number>();
  for (const n of details.foodNutrients ?? []) {
    if (n.nutrient?.id !== undefined && typeof n.amount === "number") {
      amounts.set(n.nutrient.id, n.amount);
    }
  }
  const per100g = Object.fromEntries(
    Object.entries(NUTRIENTS).map(([key, ids]) => {
      const id = ids.find((i) => amounts.has(i));
      return [key, id === undefined ? null : amounts.get(id)!];
    }),
  ) as Per100g;

  return {
    fdcId: details.fdcId,
    description: details.description,
    per100g,
    gramsPerUnit: portionWeights(details.foodPortions ?? []),
  };
}

// Portion keys that weigh a whole item.
const WHOLE_ITEM_SIZES = [
  "each",
  "small",
  "medium",
  "large",
  "extra large",
  "jumbo",
];

// Size words USDA uses for whole items ("1 large egg").
const SIZE_WORDS = new Set([
  "small",
  "medium",
  "large",
  "extra large",
  "jumbo",
  "each",
  "whole",
]);

function portionWeights(
  portions: NonNullable<FoodDetails["foodPortions"]>,
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const p of portions) {
    if (!p.gramWeight || p.gramWeight <= 0) continue;
    const amount = p.amount && p.amount > 0 ? p.amount : 1;
    const key = portionKey(p);
    // Keep the first weight for each key: USDA lists the plain portion first.
    if (key && weights[key] === undefined) {
      weights[key] = Math.round((p.gramWeight / amount) * 100) / 100;
    }
  }
  return weights;
}

// Foundation foods name the unit in measureUnit; SR Legacy leaves it
// "undetermined" and puts it in the modifier ("cup, chopped", "large").
function portionKey(
  p: NonNullable<FoodDetails["foodPortions"]>[number],
): string | null {
  const unitName = p.measureUnit?.name?.toLowerCase();
  const text =
    unitName && unitName !== "undetermined"
      ? unitName
      : (p.modifier ?? p.portionDescription ?? "");
  const head = text.toLowerCase().split(/[,(]/)[0].trim();
  if (head === "") return null;
  for (const size of SIZE_WORDS) {
    if (head === size || head.startsWith(`${size} `))
      return size === "whole" ? "each" : size;
  }
  const unit = normalizeUnit(head) ?? normalizeUnit(head.split(" ")[0]);
  if (unit) return unit;
  // Some SR Legacy foods name the item first: "potato medium (2-1/4" dia)".
  const size = head.split(" ").find((w) => SIZE_WORDS.has(w));
  return size === undefined ? null : size === "whole" ? "each" : size;
}

export type SearchResult = {
  fdcId: number;
  description: string;
  dataType?: string;
};

// Words in an ingredient line that don't change which food it is.
const IGNORED_QUERY_WORDS = new Set([
  "a",
  "and",
  "of",
  "the",
  "or",
  "fresh",
  "large",
  "medium",
  "small",
  "extra",
  "jumbo",
  "shredded",
  "grated",
  "chopped",
  "diced",
  "minced",
  "sliced",
  "cubed",
  "packed",
  "softened",
  "melted",
  "room",
  "temperature",
  "organic",
  "plain",
]);

// Description words that mean a part, form or variety of the food. Penalized
// unless the ingredient line asks for them.
const SPECIFIC_WORDS = new Set([
  "white",
  "yolk",
  "glutinous",
  "substitute",
  "imitation",
  "babyfood",
  "dried",
  "dehydrated",
  "evaporated",
  "condensed",
  "dry",
  "powder",
  "powdered",
  "frozen",
  "canned",
  "fried",
  "sauteed",
  "baked",
  "boiled",
  "roasted",
  "steamed",
  "stewed",
  "braised",
  "grilled",
  "broiled",
  "microwaved",
  "mashed",
  "breaded",
  "flavored",
  "sweetened",
  "unsweetened",
  "infant",
  "formula",
  "mix",
  "prepared",
  "restaurant",
  "fast",
  "foods",
  "brand",
  "grass-fed",
  "organic",
  "wagyu",
]);

// Filler in USDA descriptions that says nothing about which food it is.
const FILLER_WORDS = new Set([
  "a",
  "and",
  "with",
  "without",
  "added",
  "vitamin",
  "vitamins",
  "d",
  "c",
  "fluid",
  "ns",
  "nfs",
  "or",
  "of",
  "the",
  "includes",
  "usda",
  "commodity",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9%-]+/)
    .filter((w) => w !== "")
    .map((w) => (w.length > 3 && /[^su]s$/.test(w) ? w.slice(0, -1) : w));
}

// Rule-based pick of the result that best names the ingredient: every query
// word should appear, the description should start with one of them, extra
// words cost a little, part and variety words cost
// more, raw and whole are preferred unless the line says otherwise, and SR
// Legacy wins ties because it carries household portion weights.
export function bestMatch(
  query: string,
  results: readonly SearchResult[],
): SearchResult | null {
  return rankMatches(query, results)[0] ?? null;
}

// Results sorted by how well they name the ingredient, best first.
export function rankMatches(
  query: string,
  results: readonly SearchResult[],
): SearchResult[] {
  const wantedSet = new Set(wantedWords(query));

  const scored = results.map((result, rank) => {
    const desc = words(result.description);
    const descSet = new Set(desc);
    const covered = [...wantedSet].filter((w) => descSet.has(w)).length;
    let score = (covered / Math.max(wantedSet.size, 1)) * 100;
    // USDA names lead with what the food is ("Egg, whole" vs "Bagels, egg").
    if (wantedSet.has(desc[0])) score += 20;

    for (const w of descSet) {
      if (wantedSet.has(w) || FILLER_WORDS.has(w)) continue;
      score -= SPECIFIC_WORDS.has(w) ? 15 : 2;
    }
    if (!wantedSet.has("cooked") && descSet.has("raw")) score += 4;
    if (
      descSet.has("whole") &&
      !wantedSet.has("white") &&
      !wantedSet.has("yolk")
    )
      score += 4;
    // A blend lists several foods: "Oil, corn, peanut, and olive".
    if (descSet.has("and") && !wantedSet.has("and")) score -= 5;
    if (result.dataType === "SR Legacy") score += 3;
    score -= rank * 0.1; // USDA's order breaks remaining ties

    return { result, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.result);
}
