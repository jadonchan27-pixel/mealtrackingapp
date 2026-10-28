import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { createFoodLookup } from "@/lib/foods";
import { PlanError, searchSlot } from "@/lib/plans";
import { BraveError, createBraveClient } from "@/lib/services/braveSearch";
import { createUsdaClient, UsdaError } from "@/lib/services/usda";
import { isMealSlot } from "@/lib/weeks";

// One slot reads up to 20 recipe pages and looks up their foods, which took
// 80 to 93 s with an empty foods cache in the step 11 live check.
export const maxDuration = 300;

// POST /api/weeks/:id/candidates { slot } → { candidates, pagesRead, skipped }
// Searches the web for one slot and replaces its candidates with the top 3,
// the best one selected (US-8).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const weekId = Number((await params).week);
  const body = (await request.json().catch(() => null)) as {
    slot?: unknown;
  } | null;
  if (!Number.isInteger(weekId) || weekId <= 0) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  if (!isMealSlot(body?.slot)) {
    return NextResponse.json(
      { error: "Choose breakfast, lunch, dinner or snack." },
      { status: 400 },
    );
  }

  try {
    const result = await searchSlot({
      supabase,
      weekId,
      slot: body.slot,
      brave: createBraveClient(),
      lookup: createFoodLookup({ supabase, usda: createUsdaClient() }),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Every search failed, or a key is missing.
    if (err instanceof BraveError || err instanceof UsdaError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
