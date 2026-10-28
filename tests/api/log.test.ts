import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeRecipeTables } from "@/tests/helpers/fakeRecipeTables";

const requireUser = vi.fn();
vi.mock("@/lib/auth/api", () => ({ requireUser }));

const log = await import("@/app/api/log/route");
const entry = await import("@/app/api/log/[id]/route");
const restaurant = await import("@/app/api/log/restaurant/route");

function signedIn(seed: Parameters<typeof fakeRecipeTables>[0] = {}) {
  const db = fakeRecipeTables(seed);
  requireUser.mockResolvedValue({
    ok: true,
    user: { id: "u1" },
    supabase: db.client,
  });
  return db;
}

const params = <T>(p: T) => ({ params: Promise.resolve(p) });

const ENTRY = {
  id: 1,
  date: "2026-11-03",
  slot: "lunch",
  kind: "restaurant",
  status: "planned",
  plan_item_id: null,
  portion: 1,
  restaurant_name: "Chuy's",
  item_name: "Chicken enchiladas",
  kcal: 900,
  protein_g: 50,
  carbs_g: 70,
  fat_g: 40,
};

afterEach(() => {
  requireUser.mockReset();
});

describe("auth", () => {
  it("rejects the log routes when signed out", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    });
    const responses = await Promise.all([
      log.GET(new Request("http://localhost/api/log?date=2026-11-03")),
      entry.PATCH(
        new Request("http://localhost/api/log/1", {
          method: "PATCH",
          body: "{}",
        }),
        params({ id: "1" }),
      ),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401]);
  });
});

describe("GET /api/log", () => {
  it("returns the day's entries, confirmed totals and targets", async () => {
    signedIn({ seed: { log_entries: [ENTRY] } });
    const res = await log.GET(
      new Request("http://localhost/api/log?date=2026-11-03"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.date).toBe("2026-11-03");
    expect(json.entries).toHaveLength(1);
    expect(json.totals.kcal).toBe(0); // not confirmed yet
    expect(json.targets).toBeNull(); // no profile saved
  });

  it("needs a date", async () => {
    signedIn();
    for (const url of ["/api/log", "/api/log?date=2026-13-01"]) {
      const res = await log.GET(new Request(`http://localhost${url}`));
      expect(res.status).toBe(400);
    }
  });
});

describe("PATCH /api/log/:id", () => {
  it("confirms an entry, refusing a bad body or an unknown entry", async () => {
    const db = signedIn({ seed: { log_entries: [ENTRY] } });
    const patch = (id: string, body: unknown) =>
      entry.PATCH(
        new Request(`http://localhost/api/log/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
        params({ id }),
      );

    const res = await patch("1", { status: "confirmed" });
    expect(res.status).toBe(200);
    expect((await res.json()).entry).toMatchObject({
      status: "confirmed",
      nutrition: { kcal: 900 },
    });
    expect(db.table("log_entries")[0].status).toBe("confirmed");

    expect((await patch("1", { portion: 0 })).status).toBe(400);
    expect((await patch("2", { status: "confirmed" })).status).toBe(404);
    expect((await patch("abc", { status: "confirmed" })).status).toBe(404);
  });
});

describe("POST /api/log/restaurant and DELETE /api/log/:id", () => {
  it("adds an eat-out as eaten, then removes it", async () => {
    const db = signedIn();
    const res = await restaurant.POST(
      new Request("http://localhost/api/log/restaurant", {
        method: "POST",
        body: JSON.stringify({
          date: "2026-11-03",
          slot: "lunch",
          itemName: "Chicken enchiladas",
          kcal: 900,
          proteinG: 50,
          carbsG: 70,
          fatG: 40,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const { day } = await res.json();
    expect(day.totals.kcal).toBe(900);
    const id = day.entries[0].id;

    const bad = await restaurant.POST(
      new Request("http://localhost/api/log/restaurant", {
        method: "POST",
        body: JSON.stringify({ date: "2026-11-03", slot: "lunch" }),
      }),
    );
    expect(bad.status).toBe(400);

    const del = await entry.DELETE(
      new Request(`http://localhost/api/log/${id}`, { method: "DELETE" }),
      params({ id: String(id) }),
    );
    expect(del.status).toBe(200);
    expect(db.table("log_entries")).toHaveLength(0);
    const missing = await entry.DELETE(
      new Request(`http://localhost/api/log/${id}`, { method: "DELETE" }),
      params({ id: String(id) }),
    );
    expect(missing.status).toBe(404);
  });

  it("refuses to bring back a meal an eat-out replaced", async () => {
    signedIn({
      seed: {
        log_entries: [
          { ...ENTRY, id: 1, kind: "planned", status: "skipped" },
          { ...ENTRY, id: 2, status: "confirmed" },
        ],
      },
    });
    const res = await entry.PATCH(
      new Request("http://localhost/api/log/1", {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed" }),
      }),
      params({ id: "1" }),
    );
    expect(res.status).toBe(409);
  });
});
