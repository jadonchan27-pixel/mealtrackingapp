import { describe, expect, it, vi } from "vitest";
import egg from "@/tests/fixtures/usda/egg-sr-legacy.json";
import { fakeFoodsTable } from "@/tests/helpers/fakeFoodsTable";
import { toUsdaFood } from "@/lib/services/usda";
import { createFoodLookup, normalizeFoodName } from "./foods";

describe("normalizeFoodName", () => {
  it("lowercases and tidies the name", () => {
    expect(normalizeFoodName("  Boneless Chicken  Thighs. ")).toBe(
      "boneless chicken thighs",
    );
  });
});

describe("createFoodLookup", () => {
  it("calls USDA on a miss and caches the result", async () => {
    const table = fakeFoodsTable();
    const usda = { findFood: vi.fn().mockResolvedValue(toUsdaFood(egg)) };
    const lookup = createFoodLookup({ supabase: table.client, usda });

    const food = await lookup("Large Eggs");

    expect(usda.findFood).toHaveBeenCalledWith("large eggs");
    expect(food).toMatchObject({
      name: "large eggs",
      fdc_id: 171287,
      kcal_100g: 143,
      protein_100g: 12.56,
      sodium_mg_100g: 142,
      grams_per_unit: { large: 50, medium: 44 },
    });
    expect(table.rows.has("large eggs")).toBe(true);
  });

  it("reuses a cached food without calling USDA", async () => {
    const table = fakeFoodsTable();
    const usda = { findFood: vi.fn().mockResolvedValue(toUsdaFood(egg)) };
    await createFoodLookup({ supabase: table.client, usda })("large eggs");

    // A later run (say, the next recipe) starts with an empty memory.
    const again = await createFoodLookup({ supabase: table.client, usda })(
      "LARGE EGGS",
    );

    expect(again?.fdc_id).toBe(171287);
    expect(usda.findFood).toHaveBeenCalledTimes(1);
  });

  it("asks once for a food listed twice in the same run", async () => {
    const table = fakeFoodsTable();
    const usda = { findFood: vi.fn().mockResolvedValue(toUsdaFood(egg)) };
    const lookup = createFoodLookup({ supabase: table.client, usda });

    await Promise.all([lookup("eggs"), lookup("Eggs")]);

    expect(usda.findFood).toHaveBeenCalledTimes(1);
  });

  it("caches a food USDA can't match, with no nutrition", async () => {
    const table = fakeFoodsTable();
    const usda = { findFood: vi.fn().mockResolvedValue(null) };

    const food = await createFoodLookup({ supabase: table.client, usda })(
      "unobtainium",
    );
    await createFoodLookup({ supabase: table.client, usda })("unobtainium");

    expect(food).toMatchObject({
      name: "unobtainium",
      fdc_id: null,
      kcal_100g: null,
      grams_per_unit: {},
    });
    expect(usda.findFood).toHaveBeenCalledTimes(1);
  });

  it("sets user_id when given one", async () => {
    const table = fakeFoodsTable();
    const usda = { findFood: vi.fn().mockResolvedValue(null) };
    const food = await createFoodLookup({
      supabase: table.client,
      usda,
      userId: "admin-user",
    })("salt");
    expect(food?.user_id).toBe("admin-user");
  });

  it("returns null for an empty name", async () => {
    const usda = { findFood: vi.fn() };
    expect(
      await createFoodLookup({ supabase: fakeFoodsTable().client, usda })("  "),
    ).toBeNull();
    expect(usda.findFood).not.toHaveBeenCalled();
  });

  it("can retry after a failure", async () => {
    const table = fakeFoodsTable();
    const usda = {
      findFood: vi
        .fn()
        .mockRejectedValueOnce(new Error("USDA down"))
        .mockResolvedValueOnce(toUsdaFood(egg)),
    };
    const lookup = createFoodLookup({ supabase: table.client, usda });

    await expect(lookup("eggs")).rejects.toThrow("USDA down");
    expect((await lookup("eggs"))?.fdc_id).toBe(171287);
  });
});
