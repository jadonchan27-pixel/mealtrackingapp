import { describe, expect, it, vi } from "vitest";
import egg from "@/tests/fixtures/usda/egg-sr-legacy.json";
import rice from "@/tests/fixtures/usda/rice-foundation.json";
import {
  bestMatch,
  createUsdaClient,
  toUsdaFood,
  UsdaError,
  usdaApiKey,
} from "./usda";

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
        jsonResponse({
          foods: [
            { fdcId: 2, description: "Egg, white, raw, fresh" },
            { fdcId: 171287, description: "Egg, whole, raw, fresh" },
          ],
        }),
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

describe("bestMatch", () => {
  const r = (fdcId: number, description: string, dataType = "SR Legacy") => ({
    fdcId,
    description,
    dataType,
  });

  it("prefers the whole egg over egg white", () => {
    const results = [
      r(747997, "Eggs, Grade A, Large, egg white", "Foundation"),
      r(748967, "Eggs, Grade A, Large, egg whole", "Foundation"),
      r(171287, "Egg, whole, raw, fresh"),
      r(172183, "Egg, white, raw, fresh"),
      r(172184, "Egg, yolk, raw, fresh"),
    ];
    expect(bestMatch("large eggs", results)?.fdcId).toBe(171287);
  });

  it("prefers cheddar when the line says cheddar", () => {
    const results = [
      r(173431, "Cheese, parmesan, shredded"),
      r(173414, "Cheese, cheddar"),
      r(170899, "Cheese, cheddar, reduced fat"),
    ];
    expect(bestMatch("shredded cheddar cheese", results)?.fdcId).toBe(173414);
  });

  it("prefers plain cooked rice over glutinous", () => {
    const results = [
      r(169711, "Rice, white, glutinous, unenriched, cooked"),
      r(168878, "Rice, white, long-grain, regular, enriched, cooked"),
      r(169757, "Rice, white, long-grain, regular, raw, enriched"),
    ];
    expect(bestMatch("cooked white rice", results)?.fdcId).toBe(168878);
  });

  it("keeps good matches", () => {
    expect(
      bestMatch("salted butter", [
        r(173410, "Butter, salted"),
        r(173430, "Butter, without salt"),
      ])?.fdcId,
    ).toBe(173410);
    expect(
      bestMatch("boneless skinless chicken thighs", [
        r(2646171, "Chicken, thigh, boneless, skinless, raw", "Foundation"),
        r(
          171078,
          "Chicken, broilers or fryers, thigh, meat only, cooked, fried",
        ),
      ])?.fdcId,
    ).toBe(2646171);
  });

  it("asks for a part when the line does", () => {
    const results = [
      r(171287, "Egg, whole, raw, fresh"),
      r(172183, "Egg, white, raw, fresh"),
    ];
    expect(bestMatch("egg whites", results)?.fdcId).toBe(172183);
  });

  it("returns null for no results", () => {
    expect(bestMatch("anything", [])).toBeNull();
  });
});
