// Where a recipe comes from (TR-29): a web page, or Jadon himself.

const CUSTOM_PREFIX = "custom:";

// Own recipes are stored as `custom:<id>`, with Jadon's link after a "|"
// when he gave one, so they never share a row with a web recipe saved from
// the same page (whose cost and nutrition a search would overwrite).
export function customSource(id: string, link: string | null): string {
  return link ? `${CUSTOM_PREFIX}${id}|${link}` : `${CUSTOM_PREFIX}${id}`;
}

// A recipe Jadon entered himself.
export function isCustomSource(sourceUrl: string): boolean {
  return sourceUrl.startsWith(CUSTOM_PREFIX);
}

// The page a recipe links to: its source, or an own recipe's link if any.
export function recipeLink(sourceUrl: string): string | null {
  if (!isCustomSource(sourceUrl)) return sourceUrl;
  const bar = sourceUrl.indexOf("|");
  return bar === -1 ? null : sourceUrl.slice(bar + 1);
}
