// Rule-based ingredient line parser (TR-7). Turns a recipe line such as
// "1 1/2 cups cooked rice, divided" into a quantity, a unit and the food text.
// No AI: just normalizing, a few regular expressions and a unit table.

import {
  convertCooking,
  isMassUnit,
  isVolumeUnit,
  type CookingUnit,
} from "@/lib/units";

export type Measure = { quantity: number; unit: string | null };

export type ParsedIngredient = {
  status: "parsed";
  raw: string;
  // null when the line has no amount ("salt to taste").
  quantity: number | null;
  // Upper end of a range ("3-4 thighs"); null otherwise.
  quantityMax: number | null;
  // Canonical unit: a lib/units cooking unit (tsp, cup, oz, g…) or a count unit
  // (clove, can, slice…). null for plain counts ("2 eggs").
  unit: string | null;
  // Package size, as in "1 (14.5 oz) can tomatoes".
  size: Measure | null;
  food: string;
  // Prep and extras: "divided", "chopped", "to taste"…
  note: string | null;
};

export type UnparsedIngredient = {
  status: "unparsed";
  raw: string;
  reason: string;
};

export type IngredientResult = ParsedIngredient | UnparsedIngredient;

// Unit aliases → canonical name. Single letters are case-sensitive (t = tsp, T = tbsp).
const UNIT_ALIASES: Record<string, string> = {
  // volume
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  tsps: "tsp",
  t: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tbl: "tbsp",
  tblsp: "tbsp",
  T: "tbsp",
  cup: "cup",
  cups: "cup",
  c: "cup",
  "fluid ounce": "fl_oz",
  "fluid ounces": "fl_oz",
  "fl oz": "fl_oz",
  "fl. oz": "fl_oz",
  "fl.oz": "fl_oz",
  pint: "pint",
  pints: "pint",
  pt: "pint",
  quart: "quart",
  quarts: "quart",
  qt: "quart",
  gallon: "gallon",
  gallons: "gallon",
  gal: "gallon",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  ml: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  l: "l",
  // mass
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  lbs: "lb",
  gram: "g",
  grams: "g",
  g: "g",
  gr: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  // counts
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  tin: "can",
  tins: "can",
  jar: "jar",
  jars: "jar",
  package: "package",
  packages: "package",
  pkg: "package",
  packet: "package",
  packets: "package",
  bag: "bag",
  bags: "bag",
  box: "box",
  boxes: "box",
  bottle: "bottle",
  bottles: "bottle",
  container: "container",
  containers: "container",
  slice: "slice",
  slices: "slice",
  stalk: "stalk",
  stalks: "stalk",
  rib: "stalk",
  ribs: "stalk",
  sprig: "sprig",
  sprigs: "sprig",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  piece: "piece",
  pieces: "piece",
  stick: "stick",
  sticks: "stick",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  handful: "handful",
  handfuls: "handful",
  sheet: "sheet",
  sheets: "sheet",
  cube: "cube",
  cubes: "cube",
  fillet: "fillet",
  fillets: "fillet",
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  half: 0.5,
};

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

// Phrases that describe how much rather than what, kept as notes.
const NOTE_PHRASES = [
  "or more to taste",
  "or to taste",
  "to taste",
  "as needed",
  "if needed",
  "for garnish",
  "for serving",
  "to serve",
  "optional",
];

// Longest aliases first so "fl oz" wins over "fl", "tbsp" over "t".
const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .map((alias) => alias.replace(/[.]/g, "\\.").replace(/ /g, "\\s+"))
  .join("|");

// One amount: "1 1/2", "1/2", "1.5", "2".
const AMOUNT = String.raw`\d+(?:\.\d+)?\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|\.\d+`;
const AMOUNT_RE = new RegExp(`^(${AMOUNT})`);
const RANGE_RE = new RegExp(`^\\s*(?:-|to|or)\\s*(${AMOUNT})`, "i");
const UNIT_RE = new RegExp(`^(${UNIT_PATTERN})(?![a-z])\\.?`, "i");
const HYPHEN_SIZE_RE = new RegExp(
  `^(${AMOUNT})\\s*-\\s*(${UNIT_PATTERN})(?![a-z])\\.?`,
  "i",
);

export function parseIngredient(raw: string): IngredientResult {
  let s = normalize(raw);

  if (s === "") return unparsed(raw, "empty line");
  if (!/[a-z]/i.test(s)) return unparsed(raw, "no food name");
  if (s.endsWith(":")) return unparsed(raw, "section heading");

  // "Juice of 1 lemon" → 1 "lemon juice"
  const part = /^(juice|zest)\s+(?:from|of)\s+(.*)$/i.exec(s);
  let partWord: string | null = null;
  if (part) {
    partWord = part[1].toLowerCase();
    s = part[2];
  }

  s = s.replace(/^(?:about|approximately|approx\.?|around|roughly|~)\s+/i, "");

  // Quantity, possibly a range
  let quantity: number | null = null;
  let quantityMax: number | null = null;
  const amount = takeAmount(s);
  if (amount) {
    quantity = amount.value;
    s = amount.rest;
    const range = RANGE_RE.exec(s);
    if (range) {
      const max = parseAmount(range[1]);
      if (max > quantity) {
        quantityMax = max;
        s = s.slice(range[0].length);
      }
    }
  }

  // Package size: "1 (14.5 oz) can", "1 15-ounce can" or "2 x 400g tins"
  let size: Measure | null = null;
  const notes: string[] = [];
  if (quantity !== null) {
    const times = new RegExp(
      `^\\s*[x×]\\s*(${AMOUNT})\\s*(${UNIT_PATTERN})(?![a-z])\\.?`,
      "i",
    ).exec(s);
    const paren = /^\s*\(([^)]*)\)/.exec(s);
    if (times) {
      size = {
        quantity: round(parseAmount(times[1])),
        unit: canonicalUnit(times[2]),
      };
      s = s.slice(times[0].length);
    } else if (paren) {
      const inner = parseMeasure(paren[1]);
      if (inner) size = inner;
      else notes.push(paren[1].trim());
      s = s.slice(paren[0].length);
    } else {
      const hyphen = HYPHEN_SIZE_RE.exec(s.trimStart());
      if (hyphen) {
        size = {
          quantity: parseAmount(hyphen[1]),
          unit: canonicalUnit(hyphen[2]),
        };
        s = s.trimStart().slice(hyphen[0].length);
      }
    }
  }

  s = s
    .trimStart()
    .replace(/^(?:heaping|heaped|scant|level|rounded|generous)\s+/i, "");

  // Unit
  let unit: string | null = null;
  const unitMatch = UNIT_RE.exec(s);
  if (
    unitMatch &&
    isUnitHere(unitMatch[1], s.slice(unitMatch[0].length), quantity)
  ) {
    unit = canonicalUnit(unitMatch[1]);
    s = s.slice(unitMatch[0].length);
    if (quantity === null) quantity = 1; // "pinch of salt"
  }

  // "1/2 cup plus 2 tablespoons flour"
  if (quantity !== null && unit !== null) {
    const plus = new RegExp(
      `^\\s*(?:plus|\\+)\\s+(${AMOUNT})\\s*(${UNIT_PATTERN})(?![a-z])\\.?`,
      "i",
    ).exec(s);
    if (plus) {
      const extra = parseAmount(plus[1]);
      const extraUnit = canonicalUnit(plus[2]);
      const combined = addAmounts(quantity, unit, extra, extraUnit);
      if (combined !== null) {
        quantity = combined;
        if (quantityMax !== null)
          quantityMax = addAmounts(quantityMax, unit, extra, extraUnit);
      } else {
        notes.push(`plus ${plus[1]} ${plus[2]}`);
      }
      s = s.slice(plus[0].length);
    }
  }

  // Parentheses right after the unit: a package size after a count unit
  // ("1 jar (24 oz) sauce"); a weight after a volume, which is more exact
  // than the volume ("1 cup (165g) sweet potatoes" is 165 g); otherwise an
  // alternate measurement to drop ("2 cups (480 ml) water").
  const alt = /^\s*\(([^()]*)\)/.exec(s);
  if (unit !== null && alt) {
    const isCount = !isVolumeUnit(unit) && !isMassUnit(unit);
    const inner = parseMeasure(alt[1]);
    if (isCount && size === null && inner) {
      size = inner;
    } else if (
      isVolumeUnit(unit) &&
      inner?.unit != null &&
      isMassUnit(inner.unit) &&
      quantityMax === null
    ) {
      quantity = inner.quantity;
      unit = inner.unit;
    }
    s = s.slice(alt[0].length);
  }

  s = s.trim().replace(/^of\s+/i, "");

  // Notes: everything after the first comma, parentheses, and amount phrases
  const comma = s.indexOf(",");
  let food = comma >= 0 ? s.slice(0, comma) : s;
  if (comma >= 0) {
    // "chopped (optional)" → "chopped; optional"
    const rest = s.slice(comma + 1).replace(/\s*\(([^)]*)\)/g, "; $1");
    notes.push(rest.trim().replace(/^;\s*/, ""));
  }

  // Innermost parentheses first, so nested ones ("((15 ounces) rinsed and
  // drained)") come out whole. A package size inside them counts when the
  // unit is a count: "1 can black beans ((15 ounces) drained)".
  for (let prev = ""; prev !== food;) {
    prev = food;
    food = food.replace(/\(([^()]*)\)/g, (_, inner: string) => {
      const measure =
        unit !== null &&
        !isVolumeUnit(unit) &&
        !isMassUnit(unit) &&
        size === null
          ? parseMeasure(inner)
          : null;
      if (measure) size = measure;
      else notes.push(inner.trim());
      return " ";
    });
  }
  // A parenthesis left open or closed alone ("rice (do not use…" cut short),
  // and footnote marks ("rice*").
  const open = food.indexOf("(");
  if (open >= 0) {
    notes.push(food.slice(open + 1).trim());
    food = food.slice(0, open);
  }
  food = food.replace(/[)*†]/g, " ");
  for (const phrase of NOTE_PHRASES) {
    const re = new RegExp(`\\b${phrase}\\b`, "i");
    if (re.test(food)) {
      notes.push(phrase);
      food = food.replace(re, " ");
    }
  }
  food = food.replace(/\s+/g, " ").replace(/^[\s,;-]+|[\s,;-]+$/g, "");

  if (partWord) food = `${singular(food)} ${partWord}`;

  if (food === "" || !/[a-z]/i.test(food)) {
    return unparsed(raw, "no food name");
  }

  const note = notes.filter((n) => n !== "").join("; ");
  return {
    status: "parsed",
    raw,
    quantity: quantity === null ? null : round(quantity),
    quantityMax: quantityMax === null ? null : round(quantityMax),
    unit,
    size,
    food,
    note: note === "" ? null : note,
  };
}

function unparsed(raw: string, reason: string): UnparsedIngredient {
  return { status: "unparsed", raw, reason };
}

function normalize(raw: string): string {
  let s = raw
    .replace(/[\u00a0\u2009\u202f]/g, " ")
    .replace(/[\u2013\u2014\u2012]/g, "-")
    .replace(/\u2044/g, "/");
  for (const [glyph, text] of Object.entries(UNICODE_FRACTIONS)) {
    // "1½" → "1 1/2", "½" → "1/2"
    s = s.replace(new RegExp(`(\\d)?\\s*${glyph}`, "g"), (_, whole?: string) =>
      whole ? `${whole} ${text}` : ` ${text}`,
    );
  }
  return s
    .replace(/^\s*(?:[-•*▢□◦·]|\d+\.(?=\s))\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function takeAmount(s: string): { value: number; rest: string } | null {
  const digits = AMOUNT_RE.exec(s);
  if (digits)
    return { value: parseAmount(digits[1]), rest: s.slice(digits[0].length) };

  const word = /^([a-z]+)(?![a-z-])/i.exec(s);
  if (word) {
    const value = NUMBER_WORDS[word[1].toLowerCase()];
    if (
      value !== undefined &&
      Object.hasOwn(NUMBER_WORDS, word[1].toLowerCase())
    ) {
      const rest = s.slice(word[0].length);
      // "half a cup": the "a" after "half" adds nothing
      return {
        value,
        rest:
          word[1].toLowerCase() === "half"
            ? rest.replace(/^\s+an?(?![a-z])/i, "")
            : rest,
      };
    }
  }
  return null;
}

function parseAmount(text: string): number {
  const parts = text.trim().split(/\s+/);
  return parts.reduce((sum, part) => {
    if (part.includes("/")) {
      const [n, d] = part.split("/").map(Number);
      return sum + (d ? n / d : 0);
    }
    return sum + Number(part);
  }, 0);
}

// A measure written on its own, like "14.5 oz" or "8-ounce".
function parseMeasure(text: string): Measure | null {
  const m = new RegExp(
    `^\\s*(${AMOUNT})\\s*-?\\s*(${UNIT_PATTERN})\\.?\\s*$`,
    "i",
  ).exec(text);
  if (!m) return null;
  return { quantity: round(parseAmount(m[1])), unit: canonicalUnit(m[2]) };
}

function canonicalUnit(alias: string): string {
  const compact = alias.replace(/\s+/g, " ");
  // Single letters keep their case: t = tsp, T = tbsp.
  if (compact.length === 1)
    return UNIT_ALIASES[compact] ?? UNIT_ALIASES[compact.toLowerCase()];
  return UNIT_ALIASES[compact.toLowerCase()];
}

// Guards against reading the start of a food as a unit: "c" in "1 carrot" isn't
// a cup. Single-letter units need a following space or end and a quantity before them;
// "can" needs a quantity too ("can be swapped").
function isUnitHere(
  alias: string,
  after: string,
  quantity: number | null,
): boolean {
  if (alias.length === 1 || /^can$/i.test(alias)) {
    return quantity !== null && (after === "" || /^\s/.test(after));
  }
  if (quantity === null) {
    // Without a number only these read as an amount: "pinch of salt", "dash hot sauce".
    return /^(pinch|pinches|dash|dashes|handful|handfuls)$/i.test(alias);
  }
  return true;
}

function addAmounts(
  a: number,
  aUnit: string,
  b: number,
  bUnit: string,
): number | null {
  if (aUnit === bUnit) return a + b;
  const bothVolume = isVolumeUnit(aUnit) && isVolumeUnit(bUnit);
  const bothMass = isMassUnit(aUnit) && isMassUnit(bUnit);
  if (!bothVolume && !bothMass) return null;
  return a + convertCooking(b, bUnit as CookingUnit, aUnit as CookingUnit);
}

function singular(word: string): string {
  if (/oes$/i.test(word)) return word.slice(0, -2);
  if (/(?<!s)s$/i.test(word)) return word.slice(0, -1);
  return word;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// The canonical unit for a word such as "cups" or "Tbsp", or null if it isn't a unit.
export function normalizeUnit(word: string): string | null {
  const compact = word.trim().replace(/\.$/, "").replace(/\s+/g, " ");
  if (compact === "" || !Object.hasOwn(UNIT_ALIASES, compact.toLowerCase())) {
    return compact.length === 1 && Object.hasOwn(UNIT_ALIASES, compact)
      ? UNIT_ALIASES[compact]
      : null;
  }
  return canonicalUnit(compact);
}

export function parseIngredients(lines: readonly string[]): IngredientResult[] {
  return lines.map(parseIngredient);
}
