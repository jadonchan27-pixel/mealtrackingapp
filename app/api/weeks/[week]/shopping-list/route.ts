import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { loadWeekById, PlanError } from "@/lib/plans";
import { shoppingListForWeek } from "@/lib/shopping";

// GET /api/weeks/:id/shopping-list → { sections, totalCents }
// The finalized week's H-E-B list by store section, with packages, prices,
// batch marks and the total (US-15 to US-18).
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
    if (week.status !== "final") {
      return NextResponse.json(
        { error: "Finalize the week first" },
        { status: 409 },
      );
    }
    return NextResponse.json(await shoppingListForWeek(auth.supabase, week));
  } catch (err) {
    if (!(err instanceof PlanError)) throw err;
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
