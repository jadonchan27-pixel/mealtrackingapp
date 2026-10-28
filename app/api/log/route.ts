import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { loadDay } from "@/lib/log";
import { targetsForProfile } from "@/lib/targets";
import { isIsoDate } from "@/lib/weights";

// GET /api/log?date=YYYY-MM-DD → { date, entries, totals, targets }
// The day's planned and restaurant entries with nutrition, and totals of the
// confirmed ones vs the daily targets (US-20, US-23). targets is null until
// the profile is saved.
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!isIsoDate(date)) {
    return NextResponse.json(
      { error: "Send ?date=YYYY-MM-DD." },
      { status: 400 },
    );
  }
  const profile = await supabase.from("profile").select("*").maybeSingle();
  if (profile.error) {
    return NextResponse.json({ error: profile.error.message }, { status: 500 });
  }
  return NextResponse.json({
    ...(await loadDay(supabase, date)),
    targets: profile.data ? targetsForProfile(profile.data) : null,
  });
}
