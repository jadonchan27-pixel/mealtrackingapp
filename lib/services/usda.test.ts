import { describe, expect, it, vi } from "vitest";
import egg from "@/tests/fixtures/usda/egg-sr-legacy.json";
import rice from "@/tests/fixtures/usda/rice-foundation.json";
import { createUsdaClient, toUsdaFood, UsdaError, usdaApiKey } from "./usda";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("toUsdaFood", () => {
  it("reads SR Legacy nutrients and size portions", () => {
    expect(toUsdaFood(egg)).toEqual({
      fdcId: 171287,
      description: "Egg, whole, raw, fresh",
      per100g: {
        kcal: 143,
        proteinG: 12.56,
        carbsG: 0.72,
        fatG: 9.51,
        fiberG: 0,
        sugarG: 0.37,
        sodiumMg: 142,
      },
      gramsPerUnit: {
        cup: 243,
        "extra large": 56,
        jumbo: 63,
        large: 50,
        medium: 44,
        small: 38,
      },
    });
  });

  it("reads Foundation energy, missing nutrients and measure units", () => {
    const food = toUsdaFood(rice);
    expect(food.per100g).toMatchObject({
      kcal: 130,
      fiberG: null,
      sugarG: null,
    });
    expect(food.gramsPerUnit).toEqual({ cup: 158, tbsp: 12.5 });
  });

  it("copes with a food that has no nutrients or portions", () => {
    expect(toUsdaFood({ fdcId: 1, description: "Water" })).toMatchObject({
      per100g: { kcal: null, proteinG: null },
      gramsPerUnit: {},
    });
  });
});

describe("createUsdaClient", () => {
  it("searches Foundation and SR Legacy foods, then reads the best match", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ foods: [{ fdcId: 171287 }, { fdcId: 2 }] }),
      )
      .mockResolvedValueOnce(jsonResponse(egg));
    const usda = createUsdaClient({ apiKey: "test-key", fetch });

    const food = await usda.findFood("large eggs");

    expect(food?.fdcId).toBe(171287);
    const searchUrl = new URL(fetch.mock.calls[0][0]);
    expect(searchUrl.pathname).toBe("/fdc/v1/foods/search");
    expect(searchUrl.searchParams.get("query")).toBe("large eggs");
    expect(searchUrl.searchParams.get("dataType")).toBe("Foundation,SR Legacy");
    expect(searchUrl.searchParams.get("api_key")).toBe("test-key");
    expect(new URL(fetch.mock.calls[1][0]).pathname).toBe(
      "/fdc/v1/food/171287",
    );
  });

  it("returns null when nothing matches", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ foods: [] }));
    const usda = createUsdaClient({ apiKey: "k", fetch });
    expect(await usda.findFood("unobtainium")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when USDA fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 429, statusText: "Too Many Requests" }),
      );
    const usda = createUsdaClient({ apiKey: "k", fetch });
    await expect(usda.search("rice")).rejects.toThrow(
      "USDA request failed: 429",
    );
  });

  it("needs an API key", () => {
    vi.stubEnv("USDA_API_KEY", "");
    expect(() => usdaApiKey()).toThrow(UsdaError);
    vi.stubEnv("USDA_API_KEY", "from-env");
    expect(usdaApiKey()).toBe("from-env");
    vi.unstubAllEnvs();
  });
});
