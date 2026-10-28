// Recipe page reader (TR-6): fetch a recipe page and read its schema.org
// Recipe from the JSON-LD most recipe sites embed for search engines.
// https://schema.org/Recipe

export type RecipePage = {
  url: string;
  title: string;
  photoUrl: string | null;
  servings: number | null;
  cuisine: string | null;
  ingredients: string[];
  steps: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  // Prep + cook, or total when neither is given.
  activeMinutes: number | null;
};

export class RecipePageError extends Error {
  name = "RecipePageError";
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; MealTrackingApp/1.0; personal recipe reader)";
const TIMEOUT_MS = 10_000;

// The page's recipe, or null when it has no recipe data. Throws
// RecipePageError when the page can't be fetched.
export async function fetchRecipePage(
  url: string,
  { fetch: doFetch = fetch }: { fetch?: typeof fetch } = {},
): Promise<RecipePage | null> {
  let res: Response;
  try {
    res = await doFetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new RecipePageError(
      `Couldn't fetch ${url}: ${err instanceof Error ? err.message : err}`,
    );
  }
  if (!res.ok) {
    throw new RecipePageError(
      `Couldn't fetch ${url}: ${res.status} ${res.statusText}`,
    );
  }
  const type = res.headers.get("content-type") ?? "";
  if (type !== "" && !type.includes("html")) return null;
  return extractRecipe(await res.text(), res.url || url);
}

// Reads the first schema.org Recipe in the page's JSON-LD. A recipe needs a
// title and at least one ingredient, and mustn't be a roundup; anything else
// counts as no recipe.
export function extractRecipe(html: string, url: string): RecipePage | null {
  for (const data of jsonLdBlocks(html)) {
    const node = findRecipe(data);
    if (!node) continue;

    const title = text(node.name);
    const ingredients = textList(node.recipeIngredient ?? node.ingredients);
    if (title === "" || ingredients.length === 0 || isRoundup(title)) continue;

    // A zero time ("PT0M") means the site left it blank.
    const prepMinutes = durationMinutes(node.prepTime) || null;
    const cookMinutes = durationMinutes(node.cookTime) || null;
    const totalMinutes = durationMinutes(node.totalTime) || null;
    return {
      url,
      title,
      photoUrl: imageUrl(node.image, url, nodesById(data)),
      servings: servings(node.recipeYield),
      cuisine: textList(node.recipeCuisine)[0] ?? null,
      ingredients,
      steps: instructionSteps(node.recipeInstructions),
      prepMinutes,
      cookMinutes,
      totalMinutes,
      activeMinutes:
        prepMinutes === null && cookMinutes === null
          ? totalMinutes
          : (prepMinutes ?? 0) + (cookMinutes ?? 0),
    };
  }
  return null;
}

// Roundup articles ("30+ Indian Dinner Recipes", "Easy Dinner Ideas")
// sometimes carry one recipe's data; their title gives them away, while a
// single recipe's title says "Recipe" at most.
export function isRoundup(title: string): boolean {
  return /\b(recipes|ideas)\b/i.test(title);
}

type JsonNode = Record<string, unknown>;

// Every parseable <script type="application/ld+json"> block.
function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(re)) {
    const body = match[1]
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .replace(/^\s*\/\/\s*<!\[CDATA\[/, "")
      .replace(/\/\/\s*\]\]>\s*$/, "")
      .trim();
    try {
      blocks.push(JSON.parse(body));
    } catch {
      // Raw line breaks and tabs inside strings are invalid JSON but common;
      // outside strings they're only whitespace, so spaces are safe there too.
      try {
        blocks.push(JSON.parse(body.replace(/[\u0000-\u001f]+/g, " ")));
      } catch {
        // Otherwise the block is broken; skip it.
      }
    }
  }
  return blocks;
}

function isObject(v: unknown): v is JsonNode {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasType(node: JsonNode, type: string): boolean {
  const t = node["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

// Recipes sit at the top, in an array, in an @graph, or under mainEntity.
function findRecipe(data: unknown, depth = 0): JsonNode | null {
  if (depth > 5) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipe(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(data)) return null;
  if (hasType(data, "Recipe")) return data;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage"]) {
    const found = findRecipe(data[key], depth + 1);
    if (found) return found;
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  deg: "°",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

function decodeEntities(s: string): string {
  return s.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi,
    (whole, code: string) => {
      if (code[0] === "#") {
        const n =
          code[1] === "x" || code[1] === "X"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    },
  );
}

// Plain text: entities decoded, tags dropped, whitespace collapsed.
function text(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return "";
  return decodeEntities(decodeEntities(v).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function textList(v: unknown): string[] {
  const items = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return items.map(text).filter((s) => s !== "");
}

// "4", 4, "4 servings", ["4", "4 servings"], "Makes 6 to 8" → the first number.
function servings(v: unknown): number | null {
  for (const item of Array.isArray(v) ? v : [v]) {
    if (typeof item === "number" && item > 0) return item;
    const m = text(item).match(/\d+(?:\.\d+)?/);
    if (m && Number(m[0]) > 0) return Number(m[0]);
  }
  return null;
}

// ISO 8601 durations: "PT1H30M", "P0DT0H20M", "PT90M" → minutes.
export function durationMinutes(v: unknown): number | null {
  const s = text(v).toUpperCase();
  const m = s.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );
  if (!m || s === "P" || s === "PT") return null;
  const [, d, h, min, sec] = m.map((x) => (x === undefined ? 0 : Number(x)));
  return Math.round(d * 1440 + h * 60 + min + sec / 60);
}

// Every node in a block that has an @id, so references can be followed.
function nodesById(data: unknown): Map<string, JsonNode> {
  const nodes = new Map<string, JsonNode>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(v)) v.forEach((item) => walk(item, depth + 1));
    else if (isObject(v)) {
      // {"@id": "…"} alone is a reference, not the node itself.
      if (typeof v["@id"] === "string" && Object.keys(v).length > 1) {
        nodes.set(v["@id"], v);
      }
      Object.values(v).forEach((item) => walk(item, depth + 1));
    }
  };
  walk(data, 0);
  return nodes;
}

// image may be a URL, a list of URLs, an ImageObject or a list of those, or
// a reference to an ImageObject elsewhere in the @graph ({"@id": "…"}). Sites
// often list thumbnails too, so the largest image wins.
function imageUrl(
  v: unknown,
  base: string,
  nodes: Map<string, JsonNode>,
): string | null {
  let best: { url: string; area: number } | null = null;
  for (let item of Array.isArray(v) ? v : [v]) {
    if (
      isObject(item) &&
      item.url === undefined &&
      item.contentUrl === undefined &&
      typeof item["@id"] === "string"
    ) {
      item = nodes.get(item["@id"]);
    }
    const url = absoluteUrl(
      text(isObject(item) ? (item.url ?? item.contentUrl) : item),
      base,
    );
    if (url === null) continue;
    const area = imageArea(url, isObject(item) ? item : {});
    if (!best || area > best.area) best = { url, area };
  }
  return best?.url ?? null;
}

function absoluteUrl(s: string, base: string): string | null {
  if (s === "") return null;
  try {
    const u = new URL(s, base);
    return u.protocol === "https:" || u.protocol === "http:"
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}

// Pixel area from the ImageObject's size or a size in the URL
// ("-225x225.jpg", "?fit=225%2C225"). No size usually means the original.
function imageArea(url: string, node: JsonNode): number {
  const w = Number(node.width);
  const h = Number(node.height);
  if (w > 0 && h > 0) return w * h;
  const m =
    url.match(/[-_](\d{2,4})x(\d{2,4})\.[a-z]+(?:\?|$)/i) ??
    url.match(/[?&](?:fit|resize)=(\d{2,4})(?:%2C|,)(\d{2,4})/i);
  return m ? Number(m[1]) * Number(m[2]) : Infinity;
}

// Steps may be one string, a list of strings, HowToSteps, or HowToSections
// that group HowToSteps.
function instructionSteps(v: unknown, depth = 0): string[] {
  if (depth > 5 || v === undefined || v === null) return [];
  if (typeof v === "string") {
    return v
      .split(/\r?\n|<br\s*\/?>|<\/p>|<\/li>/i)
      .map(text)
      .filter((s) => s !== "");
  }
  if (Array.isArray(v)) return v.flatMap((s) => instructionSteps(s, depth + 1));
  if (!isObject(v)) return [];
  if (v.itemListElement !== undefined) {
    return instructionSteps(v.itemListElement, depth + 1);
  }
  const step = text(v.text ?? v.name);
  return step === "" ? [] : [step];
}
