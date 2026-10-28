import { describe, expect, it, vi } from "vitest";
import {
  BraveError,
  braveApiKey,
  createBraveClient,
  MAX_RESULTS,
} from "./braveSearch";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("createBraveClient", () => {
  it("searches the web and returns result URLs in order", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            { url: "https://a.test/chicken-tikka", title: "Tikka" },
            { url: "https://b.test/dal", title: "Dal" },
            { url: "https://a.test/chicken-tikka", title: "Duplicate" },
            { url: "ftp://c.test/file", title: "Not a web page" },
            { title: "No URL" },
          ],
        },
      }),
    );
    const brave = createBraveClient({ apiKey: "k", fetch });

    const urls = await brave.search("indian high protein dinner recipe");

    expect(urls).toEqual([
      "https://a.test/chicken-tikka",
      "https://b.test/dal",
    ]);
    const [url, init] = fetch.mock.calls[0];
    expect(url.origin + url.pathname).toBe(
      "https://api.search.brave.com/res/v1/web/search",
    );
    expect(url.searchParams.get("q")).toBe("indian high protein dinner recipe");
    expect(url.searchParams.get("count")).toBe(String(MAX_RESULTS));
    expect(init.headers["x-subscription-token"]).toBe("k");
  });

  it("caps the result count at Brave's maximum", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({}));
    const urls = await createBraveClient({ apiKey: "k", fetch }).search(
      "q",
      50,
    );
    expect(urls).toEqual([]);
    expect(fetch.mock.calls[0][0].searchParams.get("count")).toBe("20");
  });

  it("throws a clear error when Brave fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 429, statusText: "Too Many Requests" }),
      );
    await expect(
      createBraveClient({ apiKey: "k", fetch }).search("q"),
    ).rejects.toThrow(
      new BraveError("Brave search failed: 429 Too Many Requests"),
    );
  });
});

describe("braveApiKey", () => {
  it("reads BRAVE_API_KEY and explains when it's missing", () => {
    vi.stubEnv("BRAVE_API_KEY", "");
    expect(() => braveApiKey()).toThrow(BraveError);
    vi.stubEnv("BRAVE_API_KEY", "from-env");
    expect(braveApiKey()).toBe("from-env");
    vi.unstubAllEnvs();
  });
});
