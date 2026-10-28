import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { batchesForWeek } from "@/lib/batches";
import { loadWeekById, PlanError } from "@/lib/plans";

// GET /api/weeks/:id/batches → { batches }
// Each finalized recipe scaled for the Sunday batch (4 days) and the
// Thursday batch (3 days), with its ingredients and steps (US-12).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const weekId = Number((await params).week);
  if (!Number.isInteger(weekId) || weekId <= 0) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  try {
    const week = await loadWeekById(auth.supabase, weekId);
    return NextResponse.json({
      batches: await batchesForWeek(auth.supabase, week),
    });
  } catch (err) {
    if (!(err instanceof PlanError)) throw err;
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
