import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { roundTargets } from "@/lib/profile";
import { targetsForProfile } from "@/lib/targets";
import { movingAverage } from "@/lib/trend";
import { parseWeighIn } from "@/lib/weights";

type Supabase = Extract<
  Awaited<ReturnType<typeof requireUser>>,
  { ok: true }
>["supabase"];

async function loadEntries(supabase: Supabase) {
  const { data, error } = await supabase
    .from("weight_entries")
    .select("date, weight_lb")
    .order("date", { ascending: true });
  if (error) return { ok: false as const, message: error.message };
  return {
    ok: true as const,
    entries: movingAverage(
      data.map((row) => ({ date: row.date, weightLb: Number(row.weight_lb) })),
    ),
  };
}

// GET /api/weights → { entries: [{ date, weightLb, trendLb }] }, oldest first
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const result = await loadEntries(auth.supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }
  return NextResponse.json({ entries: result.entries });
}

// POST /api/weights { date, weightLb } → { entries, targets }
// One weigh-in per date: posting the same date again replaces it. When it's the
// newest weigh-in it also becomes the profile weight, so targets recalculate
// (US-6). `targets` is null when no profile is saved yet.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseWeighIn(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid weigh-in", fields: parsed.errors },
      { status: 400 },
    );
  }
  const { date, weightLb } = parsed.weighIn;

  const saved = await supabase
    .from("weight_entries")
    .upsert(
      { user_id: user.id, date, weight_lb: weightLb },
      { onConflict: "user_id,date" },
    );
  if (saved.error) {
    return NextResponse.json({ error: saved.error.message }, { status: 500 });
  }

  const result = await loadEntries(supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }
  const latest = result.entries.at(-1);

  const profile =
    latest?.date === date
      ? await supabase
          .from("profile")
          .update({ weight_lb: weightLb })
          .eq("user_id", user.id)
          .select("*")
          .maybeSingle()
      : await supabase.from("profile").select("*").maybeSingle();
  if (profile.error) {
    return NextResponse.json({ error: profile.error.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: result.entries,
    targets: profile.data
      ? roundTargets(targetsForProfile(profile.data))
      : null,
  });
}
