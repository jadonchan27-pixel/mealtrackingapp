import type { SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";
import type { Database, FoodRow } from "@/lib/db/types";

// An in-memory stand-in for the foods table that supports the queries the
// lookup makes: select by name, and upsert returning the row.
export function fakeFoodsTable(initial: FoodRow[] = []) {
  const rows = new Map(initial.map((r) => [r.name, r]));
  let nextId = initial.length + 1;
  const client = {
    from(table: string) {
      expect(table).toBe("foods");
      let name: string | undefined;
      let upserted: Partial<FoodRow> | undefined;
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          expect(column).toBe("name");
          name = value;
          return builder;
        },
        upsert: (row: Partial<FoodRow>) => {
          upserted = row;
          return builder;
        },
        maybeSingle: async () => ({
          data: rows.get(name!) ?? null,
          error: null,
        }),
        single: async () => {
          const row = {
            id: nextId++,
            user_id: "u1",
            section: "pantry",
            created_at: "",
            updated_at: "",
            ...upserted,
          } as FoodRow;
          rows.set(row.name, row);
          return { data: row, error: null };
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, rows };
}
