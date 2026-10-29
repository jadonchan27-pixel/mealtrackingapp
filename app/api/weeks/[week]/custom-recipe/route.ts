import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { addCustomRecipe, parseCustomRecipe } from "@/lib/customRecipe";
import { createFoodLookup } from "@/lib/foods";
import { changeDish, PlanError } from "@/lib/plans";
import { writeShoppingList } from "@/lib/shopping";
import { targetsForProfile } from "@/lib/targets";
import { austinToday } from "@/lib/weeks";
import { createUsdaClient } from "@/lib/services/usda";

// Matching a long ingredient list against USDA can take a while uncached.
export const maxDuration = 60;

// POST /api/weeks/:id/custom-recipe { slot, title, servings, kcal, proteinG,
// carbsG, fatG, ingredients?, steps?, sourceUrl?, activeMinutes?,
// costPerServing? } → { week }
// Saves Jadon's own recipe and picks it for the slot (US-35); on a finalized
// week the dish changes to it from today (US-36).
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
    const added = await addCustomRecipe(
      supabase,
      weekId,
      parsed.value,
      createFoodLookup({ supabase, usda: createUsdaClient() }),
    );
    if (added.week.status === "draft") {
      return NextResponse.json({ week: added.week });
    }
    const profile = await supabase.from("profile").select("*").maybeSingle();
    if (profile.error || !profile.data) {
      return NextResponse.json(
        {
          error: "Save your profile first, so portions can match your targets.",
        },
        { status: 409 },
      );
    }
    const week = await changeDish(
      supabase,
      weekId,
      added.candidateId,
      targetsForProfile(profile.data),
      austinToday(new Date()),
    );
    await rebuildList(supabase, week.id);
    return NextResponse.json({ week });
  } catch (err) {
    if (err instanceof PlanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// The list follows the new dish; if it fails, the shopping list request
// builds it on first view.
async function rebuildList(
  supabase: Parameters<typeof writeShoppingList>[0],
  weekId: number,
) {
  try {
    await writeShoppingList(supabase, weekId);
  } catch (err) {
    console.error("Shopping list failed; it's built on first view", err);
  }
}
