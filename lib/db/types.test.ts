import { createClient } from "@supabase/supabase-js";
import { describe, expectTypeOf, it } from "vitest";
import type { Database, WeightEntryRow } from "./types";

// Compile-time checks that the Database type works with the Supabase client.
// The queries are built but never sent.
describe("Database types", () => {
  const db = createClient<Database>("https://example.supabase.co", "anon");

  it("types selected rows", () => {
    const query = db.from("weight_entries").select("*");
    expectTypeOf(query)
      .resolves.toHaveProperty("data")
      .branded.toEqualTypeOf<WeightEntryRow[] | null>();
  });

  it("makes defaulted columns optional on insert", () => {
    expectTypeOf<
      Database["public"]["Tables"]["weight_entries"]["Insert"]
    >().toExtend<{ date: string; weight_lb: number }>();
    db.from("weight_entries").insert({ date: "2026-11-01", weight_lb: 160 });
    db.from("profile").insert({
      age: 25,
      sex: "male",
      height_in: 70,
      weight_lb: 160,
      activity_level: "moderate",
    });
  });

  it("rejects inserts missing a required column", () => {
    // @ts-expect-error weight_lb is required
    db.from("weight_entries").insert({ date: "2026-11-01" });
  });
});
