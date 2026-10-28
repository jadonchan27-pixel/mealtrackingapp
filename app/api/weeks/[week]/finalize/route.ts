import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { finalizeWeek, PlanError } from "@/lib/plans";
import { writeShoppingList } from "@/lib/shopping";
import { targetsForProfile } from "@/lib/targets";

// POST /api/weeks/:id/finalize → { week }
// Scales each pick to the daily targets, writes the plan items and a planned
// log entry for every day and slot, marks the week final (US-11), and writes
// the week's shopping list (US-15). If the list fails, the shopping list
// request builds it later.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const weekId = Number((await params).week);
  if (!Number.isInteger(weekId) || weekId <= 0) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  const profile = await supabase.from("profile").select("*").maybeSingle();
  if (profile.error) {
    return NextResponse.json({ error: profile.error.message }, { status: 500 });
  }
  if (!profile.data) {
    return NextResponse.json(
      { error: "Save your profile first, so portions can match your targets." },
      { status: 409 },
    );
  }
  try {
    const week = await finalizeWeek(
      supabase,
      weekId,
      targetsForProfile(profile.data),
    );
    try {
      await writeShoppingList(supabase, week.id);
    } catch (err) {
      console.error("Shopping list failed; it's built on first view", err);
    }
    return NextResponse.json({ week });
  } catch (err) {
    if (!(err instanceof PlanError)) throw err;
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
