import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { loadRecipe, PlanError } from "@/lib/plans";

// GET /api/recipes/:id → { recipe } with ingredients and steps (US-9).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Number((await params).id);
  try {
    const recipe =
      Number.isInteger(id) && id > 0
        ? await loadRecipe(auth.supabase, id)
        : null;
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    return NextResponse.json({ recipe });
  } catch (err) {
    if (!(err instanceof PlanError)) throw err;
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
