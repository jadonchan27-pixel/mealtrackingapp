// Brave Search API client (TR-6): finds recipe pages on the open web.
// https://api-dashboard.search.brave.com/app/documentation/web-search

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
// The most results Brave returns for one request.
export const MAX_RESULTS = 20;

export class BraveError extends Error {
  name = "BraveError";
}

export function braveApiKey(): string {
  const key = process.env.BRAVE_API_KEY;
  if (!key) {
    throw new BraveError(
      "Missing environment variable BRAVE_API_KEY. See .env.example.",
    );
  }
  return key;
}

type SearchResponse = { web?: { results?: { url?: string }[] } };

export type BraveClientOptions = { apiKey?: string; fetch?: typeof fetch };

export function createBraveClient(options: BraveClientOptions = {}) {
  const doFetch = options.fetch ?? fetch;
  const apiKey = () => options.apiKey ?? braveApiKey();

  // Result URLs in Brave's order, without duplicates or non-web links.
  // `page` 0 is the first page of results, 1 the next `count`, and so on.
  async function search(
    query: string,
    count: number = MAX_RESULTS,
    page: number = 0,
  ): Promise<string[]> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(count, MAX_RESULTS)));
    if (page > 0) url.searchParams.set("offset", String(page));
    url.searchParams.set("country", "us");
    url.searchParams.set("search_lang", "en");
    url.searchParams.set("safesearch", "strict");

    const res = await doFetch(url, {
      headers: {
        accept: "application/json",
        "x-subscription-token": apiKey(),
      },
    });
    if (!res.ok) {
      throw new BraveError(
        `Brave search failed: ${res.status} ${res.statusText}`,
      );
    }
    const json = (await res.json()) as SearchResponse;
    const urls: string[] = [];
    for (const result of json.web?.results ?? []) {
      if (!result.url || !/^https?:\/\//.test(result.url)) continue;
      if (!urls.includes(result.url)) urls.push(result.url);
    }
    return urls;
  }

  return { search };
}

export type BraveClient = ReturnType<typeof createBraveClient>;
