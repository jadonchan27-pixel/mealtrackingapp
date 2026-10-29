import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { changeDish, PlanError } from "@/lib/plans";
import { writeShoppingList } from "@/lib/shopping";
import { targetsForProfile } from "@/lib/targets";
import { austinToday } from "@/lib/weeks";

// POST /api/weeks/:id/change { candidateId } → { week }
// Changes a finalized week's dish to another candidate from today to
// Saturday, rescales portions and rebuilds the shopping list (US-36).
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
  const body = (await request.json().catch(() => null)) as {
    candidateId?: unknown;
  } | null;
  const candidateId = body?.candidateId;
  if (
    typeof candidateId !== "number" ||
    !Number.isInteger(candidateId) ||
    candidateId <= 0
  ) {
    return NextResponse.json(
      { error: "Send { candidateId } of the recipe to change to." },
      { status: 400 },
    );
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
    const week = await changeDish(
      supabase,
      weekId,
      candidateId,
      targetsForProfile(profile.data),
      austinToday(new Date()),
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
