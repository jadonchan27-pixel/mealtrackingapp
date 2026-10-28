import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RecipeIngredientRow, RecipeRow } from "@/lib/db/types";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };

const TABLES = [
  "recipes",
  "recipe_ingredients",
  "heb_products",
  "week_plans",
  "plan_candidates",
  "plan_items",
  "log_entries",
  "profile",
] as const;

// Column defaults the database fills in on insert.
const DEFAULTS: Partial<Record<(typeof TABLES)[number], Row>> = {
  week_plans: { cuisines: [], status: "draft" },
  plan_candidates: { selected: false },
  log_entries: { status: "planned", portion: 1 },
};

// An in-memory stand-in for the recipe tables (and the tables recipe search
// reads) that supports the queries the app makes: select with eq/in filters,
// order, insert (optionally returning the row), update and delete.
export function fakeRecipeTables({
  failIngredientInsert = false,
  seed = {},
}: {
  failIngredientInsert?: boolean;
  seed?: Partial<Record<(typeof TABLES)[number], Row[]>>;
} = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    TABLES.map((t) => [t, [...(seed[t] ?? [])]]),
  );
  let nextId = 1000;

  const client = {
    from(table: string) {
      if (!(table in tables)) throw new Error(`unexpected table ${table}`);
      const filters: ((r: Row) => boolean)[] = [];
      let op: "select" | "insert" | "update" | "delete" = "select";
      let inserted: Row[] = [];
      let changes: Row = {};
      let error: Result["error"] = null;
      let sortBy: { column: string; ascending: boolean } | null = null;
      const matches = () => {
        const rows = tables[table].filter((r) => filters.every((f) => f(r)));
        if (!sortBy) return rows;
        const { column, ascending } = sortBy;
        return rows.sort(
          (a, b) =>
            ((a[column] as number) - (b[column] as number)) *
            (ascending ? 1 : -1),
        );
      };

      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) {
          filters.push((r) => r[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          filters.push((r) => values.includes(r[column]));
          return builder;
        },
        order(column: string, { ascending = true } = {}) {
          sortBy = { column, ascending };
          return builder;
        },
        insert(rows: Row | Row[]) {
          op = "insert";
          if (table === "recipe_ingredients" && failIngredientInsert) {
            error = { message: "insert failed" };
            return builder;
          }
          inserted = (Array.isArray(rows) ? rows : [rows]).map((r) => ({
            id: nextId++,
            user_id: "u1",
            created_at: "",
            updated_at: "",
            ...DEFAULTS[table as (typeof TABLES)[number]],
            ...r,
          }));
          tables[table].push(...inserted);
          return builder;
        },
        update(values: Row) {
          op = "update";
          changes = values;
          return builder;
        },
        delete() {
          op = "delete";
          return builder;
        },
        maybeSingle: async (): Promise<Result> => ({
          data: matches()[0] ?? null,
          error: null,
        }),
        single: async (): Promise<Result> => ({ data: inserted[0], error }),
        then(resolve: (r: Result) => void, reject?: (e: unknown) => void) {
          try {
            if (op === "delete") {
              const gone = matches();
              tables[table] = tables[table].filter((r) => !gone.includes(r));
            }
            if (op === "update") {
              for (const r of matches()) Object.assign(r, changes);
            }
            resolve({ data: op === "select" ? matches() : null, error });
          } catch (e) {
            reject?.(e);
          }
        },
      };
      return builder;
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    recipes: () => tables.recipes as unknown as RecipeRow[],
    ingredients: () =>
      tables.recipe_ingredients as unknown as RecipeIngredientRow[],
    table: (name: (typeof TABLES)[number]) => tables[name],
  };
}
