import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import search from "@/tests/fixtures/usda/big-mac-search.json";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

const requireUser = vi.fn();
vi.mock("@/lib/auth/api", () => ({ requireUser }));
const searchDishes = vi.fn();
vi.mock("@/lib/services/usda", () => ({
  createUsdaClient: () => ({ searchDishes }),
}));

const route = await import("@/app/api/restaurant-items/route");

const get = (q: string) =>
  route.GET(new Request(`http://localhost/api/restaurant-items?q=${q}`));

afterEach(() => {
  requireUser.mockReset();
  searchDishes.mockReset();
});

describe("GET /api/restaurant-items", () => {
  it("rejects when signed out", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    });
    expect((await get("big+mac")).status).toBe(401);
  });

  it("returns items with calories and macros", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      user: { id: "u1" },
      supabase: fakeRecipeTables().client,
    });
    searchDishes.mockResolvedValue(search.foods);
    const res = await get("big%20mac");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.usdaError).toBeNull();
    expect(json.items[0]).toMatchObject({
      itemName: "McDONALD'S, BIG MAC",
      portion: "100 g",
      kcal: 257,
    });
  });

  it("needs 2 to 100 characters", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      user: { id: "u1" },
      supabase: fakeRecipeTables().client,
    });
    for (const q of ["", "a", "%20b%20", "x".repeat(101)]) {
      expect((await get(q)).status).toBe(400);
    }
    expect(searchDishes).not.toHaveBeenCalled();
  });
});
