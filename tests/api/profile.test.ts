import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// A stand-in for the Supabase query builder: records calls and resolves to `result`.
function fakeSupabase(result: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "upsert", "maybeSingle", "single"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return method === "maybeSingle" || method === "single"
        ? Promise.resolve(result)
        : builder;
    };
  }
  return { client: builder, calls };
}

const requireUser = vi.fn();
vi.mock("@/lib/auth/api", () => ({ requireUser }));

const profileRoute = await import("@/app/api/profile/route");
const targetsRoute = await import("@/app/api/targets/route");

const row = {
  user_id: "u1",
  age: 25,
  sex: "male",
  height_in: 70,
  weight_lb: 160,
  activity_level: "sedentary",
  surplus_kcal: 300,
  min_ingredients: 3,
  max_ingredients: 5,
  max_cost_cents_per_meal: null,
  weekly_budget_cents: 8000,
  created_at: "2026-10-28T00:00:00Z",
  updated_at: "2026-10-28T00:00:00Z",
};

const profile = {
  age: 25,
  sex: "male",
  heightIn: 70,
  weightLb: 160,
  activityLevel: "sedentary",
  minIngredients: 3,
  maxIngredients: 5,
  maxMealCost: null,
  weeklyBudget: 80,
};

const targets = {
  bmr: 1717,
  tdee: 2060,
  kcal: 2360,
  proteinG: 160,
  fatG: 66,
  carbsG: 282,
};

function signedIn(result: { data: unknown; error: unknown }) {
  const fake = fakeSupabase(result);
  requireUser.mockResolvedValue({
    ok: true,
    user: { id: "u1" },
    supabase: fake.client,
  });
  return fake;
}

function put(body: unknown) {
  return new Request("http://localhost/api/profile", {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  requireUser.mockReset();
});

describe("auth", () => {
  it("passes the guard's response through", async () => {
    const denied = NextResponse.json(
      { error: "Not signed in" },
      { status: 401 },
    );
    requireUser.mockResolvedValue({ ok: false, response: denied });

    expect(await profileRoute.GET()).toBe(denied);
    expect(await profileRoute.PUT(put(profile))).toBe(denied);
    expect(await targetsRoute.GET()).toBe(denied);
  });
});

describe("GET /api/profile", () => {
  it("returns the saved profile", async () => {
    signedIn({ data: row, error: null });
    const res = await profileRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ profile });
  });

  it("returns null before the first save", async () => {
    signedIn({ data: null, error: null });
    const res = await profileRoute.GET();
    expect(await res.json()).toEqual({ profile: null });
  });

  it("reports database errors", async () => {
    signedIn({ data: null, error: { message: "boom" } });
    const res = await profileRoute.GET();
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/profile", () => {
  it("upserts the profile and returns new targets", async () => {
    const fake = signedIn({ data: row, error: null });

    const res = await profileRoute.PUT(put(profile));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ profile, targets });
    const upsert = fake.calls.find((c) => c.method === "upsert");
    expect(upsert?.args).toEqual([
      {
        user_id: "u1",
        age: 25,
        sex: "male",
        height_in: 70,
        weight_lb: 160,
        activity_level: "sedentary",
        min_ingredients: 3,
        max_ingredients: 5,
        max_cost_cents_per_meal: null,
        weekly_budget_cents: 8000,
      },
      { onConflict: "user_id" },
    ]);
  });

  it("rejects an invalid profile without writing", async () => {
    const fake = signedIn({ data: row, error: null });

    const res = await profileRoute.PUT(put({ ...profile, age: 5 }));

    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("age");
    expect(fake.calls).toEqual([]);
  });

  it("rejects a body that isn't JSON", async () => {
    signedIn({ data: row, error: null });
    const res = await profileRoute.PUT(put("not json"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/targets", () => {
  it("computes targets from the saved profile", async () => {
    signedIn({ data: row, error: null });
    const res = await targetsRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ targets });
  });

  it("responds 404 before the profile is saved", async () => {
    signedIn({ data: null, error: null });
    const res = await targetsRoute.GET();
    expect(res.status).toBe(404);
  });
});
