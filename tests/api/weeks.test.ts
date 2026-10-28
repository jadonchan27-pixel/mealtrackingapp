import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

const requireUser = vi.fn();
vi.mock("@/lib/auth/api", () => ({ requireUser }));

const weeks = await import("@/app/api/weeks/route");
const week = await import("@/app/api/weeks/[week]/route");
const candidates = await import("@/app/api/weeks/[week]/candidates/route");
const candidate = await import("@/app/api/candidates/[id]/route");
const recipe = await import("@/app/api/recipes/[id]/route");
const finalize = await import("@/app/api/weeks/[week]/finalize/route");
const batches = await import("@/app/api/weeks/[week]/batches/route");
const reset = await import("@/app/api/weeks/[week]/reset/route");

function signedIn(seed: Parameters<typeof fakeRecipeTables>[0] = {}) {
  const db = fakeRecipeTables(seed);
  requireUser.mockResolvedValue({
    ok: true,
    user: { id: "u1" },
    supabase: db.client,
  });
  return db;
}

function request(method: string, body?: unknown) {
  return new Request("http://localhost/api", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = <T>(p: T) => ({ params: Promise.resolve(p) });

afterEach(() => {
  requireUser.mockReset();
});

describe("auth", () => {
  it("rejects every plan route when signed out", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    });
    const responses = await Promise.all([
      weeks.POST(request("POST", {})),
      week.GET(request("GET"), params({ week: "2026-11-01" })),
      candidates.POST(request("POST", {}), params({ week: "1" })),
      candidate.PATCH(request("PATCH", {}), params({ id: "1" })),
      recipe.GET(request("GET"), params({ id: "1" })),
      reset.POST(request("POST"), params({ week: "1" })),
    ]);
    expect(responses.map((r) => r.status)).toEqual([
      401, 401, 401, 401, 401, 401,
    ]);
  });
});

describe("POST /api/weeks", () => {
  it("starts the week", async () => {
    signedIn();
    const res = await weeks.POST(
      request("POST", { weekStart: "2026-11-01", cuisines: ["Indian"] }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).week).toMatchObject({
      weekStart: "2026-11-01",
      cuisines: ["Indian"],
      status: "draft",
    });
  });

  it("explains a bad request", async () => {
    signedIn();
    const res = await weeks.POST(request("POST", { weekStart: "2026-10-31" }));
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toEqual({
      weekStart: "The week must start on a Sunday.",
    });
  });

  it("refuses to change a finalized week", async () => {
    signedIn({
      seed: {
        week_plans: [{ id: 1, week_start: "2026-11-01", status: "final" }],
      },
    });
    const res = await weeks.POST(request("POST", { weekStart: "2026-11-01" }));
    expect(res.status).toBe(409);
  });
});

describe("GET /api/weeks/:weekStart", () => {
  it("returns the week, or 404 before it's started", async () => {
    signedIn({
      seed: { week_plans: [{ id: 1, week_start: "2026-11-01", cuisines: [] }] },
    });
    const found = await week.GET(
      request("GET"),
      params({ week: "2026-11-01" }),
    );
    expect((await found.json()).week).toMatchObject({ id: 1 });
    const missing = await week.GET(
      request("GET"),
      params({ week: "2026-11-08" }),
    );
    expect(missing.status).toBe(404);
    const bad = await week.GET(request("GET"), params({ week: "2026-11-02" }));
    expect(bad.status).toBe(400);
  });
});

describe("POST /api/weeks/:id/candidates", () => {
  it("needs a meal slot and a real week", async () => {
    signedIn();
    const noSlot = await candidates.POST(
      request("POST", { slot: "brunch" }),
      params({ week: "1" }),
    );
    expect(noSlot.status).toBe(400);
    const noWeek = await candidates.POST(
      request("POST", { slot: "lunch" }),
      params({ week: "abc" }),
    );
    expect(noWeek.status).toBe(404);
  });
});

describe("PATCH /api/candidates/:id", () => {
  it("picks the candidate", async () => {
    signedIn({
      seed: {
        week_plans: [{ id: 1, week_start: "2026-11-01", status: "draft" }],
        recipes: [{ id: 5, title: "Dal", servings: 2 }],
        plan_candidates: [
          {
            id: 1,
            week_plan_id: 1,
            slot: "lunch",
            recipe_id: 5,
            rank: 1,
            selected: true,
          },
          {
            id: 2,
            week_plan_id: 1,
            slot: "lunch",
            recipe_id: 5,
            rank: 2,
            selected: false,
          },
        ],
      },
    });
    const res = await candidate.PATCH(
      request("PATCH", { selected: true }),
      params({ id: "2" }),
    );
    expect(res.status).toBe(200);
    const { candidates: list } = await res.json();
    expect(list.map((c: { selected: boolean }) => c.selected)).toEqual([
      false,
      true,
    ]);
  });

  it("only accepts a pick of a known candidate", async () => {
    signedIn();
    const bad = await candidate.PATCH(
      request("PATCH", { selected: false }),
      params({ id: "2" }),
    );
    expect(bad.status).toBe(400);
    const missing = await candidate.PATCH(
      request("PATCH", { selected: true }),
      params({ id: "2" }),
    );
    expect(missing.status).toBe(404);
  });
});

describe("GET /api/recipes/:id", () => {
  it("returns 404 for an unknown recipe", async () => {
    signedIn();
    const res = await recipe.GET(request("GET"), params({ id: "3" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/weeks/:id/finalize", () => {
  const picks = ["breakfast", "lunch", "dinner", "snack"].map((slot, i) => ({
    id: i + 1,
    week_plan_id: 1,
    slot,
    recipe_id: i + 1,
    rank: 1,
    selected: true,
  }));
  const recipes = [1, 2, 3, 4].map((id) => ({
    id,
    title: `Recipe ${id}`,
    servings: 2,
    kcal: 300 + id * 100,
    protein_g: 30,
    carbs_g: 40,
    fat_g: 15,
  }));
  const week1 = { id: 1, week_start: "2026-11-01", status: "draft" };

  it("needs a saved profile for the targets", async () => {
    signedIn({
      seed: { week_plans: [week1], plan_candidates: picks, recipes },
    });
    const res = await finalize.POST(request("POST"), params({ week: "1" }));
    expect(res.status).toBe(409);
  });

  it("finalizes the week", async () => {
    const db = signedIn({
      seed: {
        week_plans: [week1],
        plan_candidates: picks,
        recipes,
        profile: [
          {
            age: 25,
            sex: "male",
            height_in: 70,
            weight_lb: 160,
            activity_level: "light",
            surplus_kcal: 300,
          },
        ],
      },
    });
    const res = await finalize.POST(request("POST"), params({ week: "1" }));
    expect(res.status).toBe(200);
    const { week: finalized } = await res.json();
    expect(finalized.status).toBe("final");
    expect(finalized.items).toHaveLength(4);
    expect(db.table("log_entries")).toHaveLength(28);
  });
});

describe("GET /api/weeks/:id/batches", () => {
  it("needs a finalized week", async () => {
    signedIn({
      seed: {
        week_plans: [{ id: 1, week_start: "2026-11-01", status: "draft" }],
      },
    });
    const draft = await batches.GET(request("GET"), params({ week: "1" }));
    expect(draft.status).toBe(409);
    const missing = await batches.GET(request("GET"), params({ week: "2" }));
    expect(missing.status).toBe(404);
  });
});

describe("POST /api/weeks/:id/reset", () => {
  it("deletes the week, or 404 for an unknown one", async () => {
    const db = signedIn({
      seed: {
        week_plans: [{ id: 1, week_start: "2026-11-01", status: "final" }],
        plan_candidates: [
          { id: 1, week_plan_id: 1, slot: "lunch", recipe_id: 1, rank: 1 },
        ],
      },
    });
    const res = await reset.POST(request("POST"), params({ week: "1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.table("week_plans")).toHaveLength(0);
    expect(db.table("plan_candidates")).toHaveLength(0);

    for (const id of ["1", "abc"]) {
      const missing = await reset.POST(request("POST"), params({ week: id }));
      expect(missing.status).toBe(404);
    }
  });
});
