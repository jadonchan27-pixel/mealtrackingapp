import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };

// A stand-in for the Supabase client. Each from() starts a query that records its
// calls and resolves to the next queued result when awaited.
function fakeSupabase(results: Result[]) {
  const queries: { table: string; calls: [string, ...unknown[]][] }[] = [];
  const client = {
    from(table: string) {
      const query = { table, calls: [] as [string, ...unknown[]][] };
      queries.push(query);
      const result = results.shift() ?? {
        data: null,
        error: "no result queued",
      };
      const builder: Record<string, unknown> = {
        then: (resolve: (r: Result) => unknown) => resolve(result),
      };
      for (const method of [
        "select",
        "upsert",
        "update",
        "eq",
        "order",
        "maybeSingle",
      ]) {
        builder[method] = (...args: unknown[]) => {
          query.calls.push([method, ...args]);
          return builder;
        };
      }
      return builder;
    },
  };
  return { client, queries };
}

const requireUser = vi.fn();
vi.mock("@/lib/auth/api", () => ({ requireUser }));

const { GET, POST } = await import("@/app/api/weights/route");

const profileRow = {
  user_id: "u1",
  age: 25,
  sex: "male",
  height_in: 70,
  weight_lb: 162,
  activity_level: "sedentary",
  surplus_kcal: 300,
  created_at: "2026-10-28T00:00:00Z",
  updated_at: "2026-10-28T00:00:00Z",
};

function signedIn(results: Result[]) {
  const fake = fakeSupabase(results);
  requireUser.mockResolvedValue({
    ok: true,
    user: { id: "u1" },
    supabase: fake.client,
  });
  return fake;
}

function post(body: unknown) {
  return new Request("http://localhost/api/weights", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ok = (data: unknown): Result => ({ data, error: null });

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
    expect(await GET()).toBe(denied);
    expect(await POST(post({ date: "2026-11-01", weightLb: 160 }))).toBe(
      denied,
    );
  });
});

describe("GET /api/weights", () => {
  it("returns weigh-ins oldest first with the trend", async () => {
    const fake = signedIn([
      ok([
        { date: "2026-11-01", weight_lb: 160 },
        { date: "2026-11-08", weight_lb: 162 },
      ]),
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      entries: [
        { date: "2026-11-01", weightLb: 160, trendLb: 160 },
        { date: "2026-11-08", weightLb: 162, trendLb: 161 },
      ],
    });
    expect(fake.queries[0].calls).toContainEqual([
      "order",
      "date",
      { ascending: true },
    ]);
  });

  it("reports database errors", async () => {
    signedIn([{ data: null, error: { message: "boom" } }]);
    expect((await GET()).status).toBe(500);
  });
});

describe("POST /api/weights", () => {
  it("saves the newest weigh-in and updates the profile weight", async () => {
    const fake = signedIn([
      ok(null),
      ok([
        { date: "2026-11-01", weight_lb: 160 },
        { date: "2026-11-08", weight_lb: 162 },
      ]),
      ok(profileRow),
    ]);

    const res = await POST(post({ date: "2026-11-08", weightLb: 162 }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.entries).toHaveLength(2);
    expect(json.targets.proteinG).toBe(162);

    const [upsert, , profile] = fake.queries;
    expect(upsert.table).toBe("weight_entries");
    expect(upsert.calls[0]).toEqual([
      "upsert",
      { user_id: "u1", date: "2026-11-08", weight_lb: 162 },
      { onConflict: "user_id,date" },
    ]);
    expect(profile.table).toBe("profile");
    expect(profile.calls).toContainEqual(["update", { weight_lb: 162 }]);
    expect(profile.calls).toContainEqual(["eq", "user_id", "u1"]);
  });

  it("leaves the profile weight alone for an older weigh-in", async () => {
    const fake = signedIn([
      ok(null),
      ok([
        { date: "2026-10-25", weight_lb: 158 },
        { date: "2026-11-08", weight_lb: 162 },
      ]),
      ok(profileRow),
    ]);

    const res = await POST(post({ date: "2026-10-25", weightLb: 158 }));

    expect(res.status).toBe(200);
    const profile = fake.queries[2];
    expect(profile.calls.map(([m]) => m)).not.toContain("update");
    expect((await res.json()).targets.proteinG).toBe(162);
  });

  it("returns null targets before the profile is saved", async () => {
    signedIn([
      ok(null),
      ok([{ date: "2026-11-08", weight_lb: 162 }]),
      ok(null),
    ]);
    const res = await POST(post({ date: "2026-11-08", weightLb: 162 }));
    expect((await res.json()).targets).toBeNull();
  });

  it("rejects an invalid weigh-in without writing", async () => {
    const fake = signedIn([]);
    const res = await POST(post({ date: "2026-02-30", weightLb: 160 }));
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("date");
    expect(fake.queries).toEqual([]);
  });

  it("rejects a body that isn't JSON", async () => {
    signedIn([]);
    expect((await POST(post("nope"))).status).toBe(400);
  });

  it("reports a failed save", async () => {
    signedIn([{ data: null, error: { message: "boom" } }]);
    const res = await POST(post({ date: "2026-11-08", weightLb: 162 }));
    expect(res.status).toBe(500);
  });
});
