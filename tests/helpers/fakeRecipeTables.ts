import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RecipeIngredientRow, RecipeRow } from "@/lib/db/types";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };

// An in-memory stand-in for the recipes and recipe_ingredients tables that
// supports the queries saveRecipeFromUrl makes: select with eq filters,
// insert (optionally returning the row) and delete with eq filters.
export function fakeRecipeTables({
  failIngredientInsert = false,
}: { failIngredientInsert?: boolean } = {}) {
  const tables: Record<string, Row[]> = { recipes: [], recipe_ingredients: [] };
  let nextId = 1;

  const client = {
    from(table: string) {
      if (!(table in tables)) throw new Error(`unexpected table ${table}`);
      const filters: [string, unknown][] = [];
      let op: "select" | "insert" | "delete" = "select";
      let inserted: Row[] = [];
      let error: Result["error"] = null;
      const matches = () =>
        tables[table].filter((r) => filters.every(([k, v]) => r[k] === v));

      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) {
          filters.push([column, value]);
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
            ...r,
          }));
          tables[table].push(...inserted);
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
  };
}
