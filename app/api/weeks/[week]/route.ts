import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { loadWeek, PlanError } from "@/lib/plans";
import { isSunday } from "@/lib/weeks";

// GET /api/weeks/:weekStart → { week } with its candidates per slot, or 404
// when that week hasn't been started.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { week: weekStart } = await params;
  if (!isSunday(weekStart)) {
    return NextResponse.json(
      { error: "The week must start on a Sunday (YYYY-MM-DD)." },
      { status: 400 },
    );
  }
  try {
    const week = await loadWeek(auth.supabase, weekStart);
    if (!week) {
      return NextResponse.json({ error: "Week not found" }, { status: 404 });
    }
    return NextResponse.json({ week });
  } catch (err) {
    if (!(err instanceof PlanError)) throw err;
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
