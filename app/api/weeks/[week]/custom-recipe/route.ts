import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { addCustomRecipe, parseCustomRecipe } from "@/lib/customRecipe";
import { createFoodLookup } from "@/lib/foods";
import { PlanError } from "@/lib/plans";
import { createUsdaClient, UsdaError } from "@/lib/services/usda";

// POST /api/weeks/:id/custom-recipe { slot, title, servings, kcal, proteinG,
// carbsG, fatG, ingredients?, steps?, sourceUrl?, activeMinutes?,
// costPerServing? } → { week }
// Saves Jadon's own recipe and picks it for the slot (US-35).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const weekId = Number((await params).week);
  if (!Number.isInteger(weekId) || weekId <= 0) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  const parsed = parseCustomRecipe(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Check the highlighted fields.", errors: parsed.errors },
      { status: 400 },
    );
  }
  try {
    const week = await addCustomRecipe(
      supabase,
      weekId,
      parsed.value,
      createFoodLookup({ supabase, usda: createUsdaClient() }),
    );
    return NextResponse.json({ week });
  } catch (err) {
    if (err instanceof PlanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof UsdaError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
