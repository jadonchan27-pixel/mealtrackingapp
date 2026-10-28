import { describe, expect, it, vi } from "vitest";
import egg from "@/tests/fixtures/usda/egg-sr-legacy.json";
import rice from "@/tests/fixtures/usda/rice-foundation.json";
import {
  bestMatch,
  createUsdaClient,
  toUsdaFood,
  type FoodDetails,
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

  it("reads sizes named after the food", () => {
    const food = toUsdaFood({
      fdcId: 170030,
      description: "Potatoes, Russet, flesh and skin, baked",
      foodPortions: [
        {
          amount: 1,
          modifier: 'potato medium (2-1/4" to 3-1/4" dia)',
          gramWeight: 173,
        },
        { amount: 1, modifier: "potato, large", gramWeight: 299 },
      ],
    });
    expect(food.gramsPerUnit).toEqual({ medium: 173 });
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

  it("borrows SR Legacy portions when the match has none", async () => {
    const foundationEgg = {
      fdcId: 748967,
      description: "Eggs, Grade A, Large, egg whole",
      foodNutrients: [{ nutrient: { id: 1008 }, amount: 148 }],
      foodPortions: [],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [
            {
              fdcId: 748967,
              description: "Eggs, Grade A, Large, egg whole",
              dataType: "Foundation",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(foundationEgg))
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [
            {
              fdcId: 171287,
              description: "Egg, whole, raw, fresh",
              dataType: "SR Legacy",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(egg));
    const usda = createUsdaClient({ apiKey: "k", fetch });

    const food = await usda.findFood("large eggs");

    expect(food).toMatchObject({
      fdcId: 748967,
      per100g: { kcal: 148 },
      gramsPerUnit: { large: 50, medium: 44 },
    });
    expect(new URL(fetch.mock.calls[2][0]).searchParams.get("dataType")).toBe(
      "SR Legacy",
    );
  });

  it("adds whole-item sizes when the match only has volume portions", async () => {
    const onion = {
      fdcId: 790646,
      description: "Onions, yellow, raw",
      foodNutrients: [{ nutrient: { id: 1008 }, amount: 38 }],
      foodPortions: [
        { amount: 1, gramWeight: 87, measureUnit: { name: "cup" } },
      ],
    };
    const legacyOnion = {
      fdcId: 170000,
      description: "Onions, raw",
      foodPortions: [
        { amount: 1, modifier: "cup, chopped", gramWeight: 160 },
        { amount: 1, modifier: 'medium (2-1/2" dia)', gramWeight: 110 },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 790646, description: "Onions, yellow, raw" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(onion))
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 170000, description: "Onions, raw" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(legacyOnion));
    const usda = createUsdaClient({ apiKey: "k", fetch });

    const food = await usda.findFood("yellow onion");

    expect(food?.gramsPerUnit).toEqual({ cup: 87, medium: 110 });
  });

  it("keeps looking in SR Legacy until a food weighs a whole item", async () => {
    const onion = {
      fdcId: 790646,
      description: "Onions, yellow, raw",
      foodNutrients: [{ nutrient: { id: 1008 }, amount: 40 }],
      foodPortions: [
        { amount: 1, gramWeight: 87, measureUnit: { name: "cup" } },
      ],
    };
    const sauteed = {
      fdcId: 170004,
      description: "Onions, yellow, sauteed",
      foodPortions: [{ amount: 1, modifier: "cup, chopped", gramWeight: 87 }],
    };
    const legacyOnion = {
      fdcId: 170000,
      description: "Onions, raw",
      foodPortions: [
        { amount: 1, modifier: 'medium (2-1/2" dia)', gramWeight: 110 },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 790646, description: "Onions, yellow, raw" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(onion))
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 170004, description: "Onions, yellow, sauteed" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(sauteed))
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [
            { fdcId: 170004, description: "Onions, yellow, sauteed" },
            { fdcId: 170000, description: "Onions, raw" },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(legacyOnion));
    const usda = createUsdaClient({ apiKey: "k", fetch });

    const food = await usda.findFood("yellow onion");

    expect(food?.gramsPerUnit).toEqual({ cup: 87, medium: 110 });
    expect(new URL(fetch.mock.calls[4][0]).searchParams.get("query")).toBe(
      "onion",
    );
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("borrows only whole-item sizes from a different variety", async () => {
    const cheddar = {
      fdcId: 328637,
      description: "Cheese, cheddar",
      foodNutrients: [{ nutrient: { id: 1008 }, amount: 40 }],
    };
    const parmesan = {
      fdcId: 171247,
      description: "Cheese, parmesan, grated",
      foodPortions: [
        { amount: 1, modifier: "cup", gramWeight: 100 },
        { amount: 1, modifier: "oz", gramWeight: 28.35 },
      ],
    };
    const string = {
      fdcId: 170851,
      description: "Cheese, mozzarella, string",
      foodPortions: [
        { amount: 1, modifier: "cup, shredded", gramWeight: 112 },
        { amount: 1, modifier: "each", gramWeight: 28 },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 328637, description: "Cheese, cheddar" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(cheddar))
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [
            { fdcId: 171247, description: "Cheese, parmesan, grated" },
            { fdcId: 170851, description: "Cheese, mozzarella, string" },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(parmesan))
      .mockResolvedValueOnce(jsonResponse(string));
    const usda = createUsdaClient({ apiKey: "k", fetch });

    const food = await usda.findFood("cheddar cheese");

    expect(food?.gramsPerUnit).toEqual({ each: 28 });
  });

  it("borrows every portion from the plain form of the same food", async () => {
    const onion = {
      fdcId: 790646,
      description: "Onions, yellow, raw",
      foodNutrients: [{ nutrient: { id: 1008 }, amount: 40 }],
    };
    const legacyOnion = {
      fdcId: 170000,
      description: "Onions, raw",
      foodPortions: [
        { amount: 1, modifier: "cup, chopped", gramWeight: 160 },
        { amount: 1, modifier: 'medium (2-1/2" dia)', gramWeight: 110 },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 790646, description: "Onions, yellow, raw" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(onion))
      .mockResolvedValueOnce(jsonResponse({ foods: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 170000, description: "Onions, raw" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(legacyOnion));
    const usda = createUsdaClient({ apiKey: "k", fetch });

    const food = await usda.findFood("yellow onion");

    expect(food?.gramsPerUnit).toEqual({ cup: 160, medium: 110 });
  });

  it("doesn't search again when the match has whole-item sizes", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 171287, description: "Egg, whole, raw, fresh" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(egg));
    await createUsdaClient({ apiKey: "k", fetch }).findFood("eggs");
    expect(fetch).toHaveBeenCalledTimes(2);
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

  it("searches USDA's name for foods it gets wrong", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ foods: [] }));
    await createUsdaClient({ apiKey: "k", fetch }).findFood(
      "Red pepper flakes",
    );
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("query")).toBe(
      "spices pepper red or cayenne",
    );
  });

  // Routes Foundation and SR Legacy searches, and food reads, to fixtures.
  function router(foundation: FoodDetails, legacy: FoodDetails | null = null) {
    return vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith("/foods/search")) {
        const found =
          url.searchParams.get("dataType") === "SR Legacy"
            ? legacy
            : foundation;
        return jsonResponse({
          foods: found
            ? [{ fdcId: found.fdcId, description: found.description }]
            : [],
        });
      }
      const id = Number(url.pathname.split("/").pop());
      return jsonResponse(id === legacy?.fdcId ? legacy : foundation);
    });
  }

  it("works out missing energy from the macros", async () => {
    const oil: FoodDetails = {
      fdcId: 748608,
      description: "Oil, olive, extra virgin",
      foodNutrients: [{ nutrient: { id: 1004 }, amount: 100 }],
      foodPortions: [
        { amount: 1, gramWeight: 13.5, measureUnit: { name: "tablespoon" } },
      ],
    };
    const food = await createUsdaClient({
      apiKey: "k",
      fetch: router(oil),
    }).findFood("extra virgin olive oil");
    expect(food?.per100g).toMatchObject({ kcal: 900, fatG: 100 });
  });

  it("takes energy from SR Legacy when the match has no nutrients at all", async () => {
    const bare: FoodDetails = {
      fdcId: 748608,
      description: "Oil, olive, extra virgin",
      foodPortions: [
        { amount: 1, gramWeight: 0.91, measureUnit: { name: "ml" } },
      ],
    };
    const legacy: FoodDetails = {
      fdcId: 171413,
      description: "Oil, olive, salad or cooking",
      foodNutrients: [
        { nutrient: { id: 1008 }, amount: 884 },
        { nutrient: { id: 1004 }, amount: 100 },
      ],
      foodPortions: [{ amount: 1, modifier: "tbsp", gramWeight: 13.5 }],
    };
    const food = await createUsdaClient({
      apiKey: "k",
      fetch: router(bare, legacy),
    }).findFood("extra virgin olive oil");
    expect(food).toMatchObject({
      fdcId: 171413,
      per100g: { kcal: 884 },
      gramsPerUnit: { tbsp: 13.5, ml: 0.91 },
    });
  });

  it("gives fats without a volume portion a tablespoon weight", async () => {
    const ghee = {
      fdcId: 171314,
      description: "Butter, Clarified butter (ghee)",
      foodNutrients: [{ nutrient: { id: 1008 }, amount: 900 }],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          foods: [{ fdcId: 171314, description: ghee.description }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(ghee))
      .mockResolvedValue(jsonResponse({ foods: [] }));
    const food = await createUsdaClient({ apiKey: "k", fetch }).findFood(
      "ghee",
    );
    expect(food?.gramsPerUnit).toEqual({ tbsp: 13.6 });
  });

  it("treats a name USDA rejects as no match", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 400, statusText: "Bad Request" }),
      );
    const usda = createUsdaClient({ apiKey: "k", fetch });
    expect(await usda.findFood("½ of a 🌶️")).toBeNull();
  });

  it("still throws when USDA is down or rate limited", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 503, statusText: "Service Unavailable" }),
      );
    await expect(
      createUsdaClient({ apiKey: "k", fetch }).findFood("rice"),
    ).rejects.toMatchObject({ status: 503 });
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

  it("prefers a raw food over a cooked one the line doesn't ask for", () => {
    const results = [
      r(170030, "Potatoes, Russet, flesh and skin, baked"),
      r(170027, "Potatoes, russet, flesh and skin, raw"),
    ];
    expect(bestMatch("russet potatoes", results)?.fdcId).toBe(170027);
  });

  it("prefers canned beans when the line says canned", () => {
    const results = [
      r(173735, "Beans, black, mature seeds, raw"),
      r(175188, "Beans, black, mature seeds, canned, low sodium"),
    ];
    expect(bestMatch("canned black beans", results)?.fdcId).toBe(175188);
  });

  it("reads ground spices as the spice and ground meat as meat", () => {
    const results = [
      r(171116, "Chicken, ground, raw"),
      r(170923, "Spices, cumin seed"),
    ];
    expect(bestMatch("ground cumin", results)?.fdcId).toBe(170923);
    expect(
      bestMatch("ground beef", [
        r(1, "Beef, ground, 80% lean meat / 20% fat, raw"),
        r(2, "Beef, chuck, raw"),
      ])?.fdcId,
    ).toBe(1);
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

  it("prefers a description that starts with the food", () => {
    const results = [
      r(174901, "Bagels, egg"),
      r(747997, "Eggs, Grade A, Large, egg white", "Foundation"),
      r(171287, "Egg, whole, raw, fresh"),
    ];
    expect(bestMatch("large eggs", results)?.fdcId).toBe(171287);
  });

  it("matches 2% milk to fluid milk, not evaporated", () => {
    const results = [
      r(171302, "Milk, evaporated, 2% fat, with added vitamin A and vitamin D"),
      r(
        171267,
        "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D",
      ),
      r(171265, "Milk, whole, 3.25% milkfat, with added vitamin D"),
    ];
    expect(bestMatch("2% milk", results)?.fdcId).toBe(171267);
  });

  it("prefers a single oil over a blend", () => {
    const results = [
      r(167737, "Oil, corn, peanut, and olive"),
      r(171413, "Oil, olive, salad or cooking"),
    ];
    expect(bestMatch("olive oil", results)?.fdcId).toBe(171413);
  });

  it("prefers plain ground beef over grass-fed", () => {
    const results = [
      r(168608, "Beef, grass-fed, ground, raw"),
      r(174036, "Beef, ground, 80% lean meat / 20% fat, raw"),
    ];
    expect(bestMatch("ground beef", results)?.fdcId).toBe(174036);
  });

  it("returns null for no results", () => {
    expect(bestMatch("anything", [])).toBeNull();
  });
});
