import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { PlanError, startWeek } from "@/lib/plans";
import { parseNewWeek } from "@/lib/weeks";

// POST /api/weeks { weekStart, cuisines? } → { week }
// Starts the week's draft plan, or changes the cuisines of a draft already
// started. With no cuisines, the app picks one not used last week (US-7).
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseNewWeek(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid week", fields: parsed.errors },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      week: await startWeek(auth.supabase, parsed.week),
    });
  } catch (err) {
    if (!(err instanceof PlanError)) throw err;
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
