import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { PlanError, resetWeek } from "@/lib/plans";

// POST /api/weeks/:id/reset → { ok: true }
// Starts the week over: deletes its plan, shortlist and planned log entries
// so cuisines can be chosen again (US-29).
export async function POST(
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
    await resetWeek(auth.supabase, weekId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (!(err instanceof PlanError)) throw err;
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
