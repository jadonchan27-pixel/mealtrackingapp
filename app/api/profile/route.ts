import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import {
  parseProfile,
  profileFromRow,
  profileToRow,
  roundTargets,
} from "@/lib/profile";
import { targetsForProfile } from "@/lib/targets";

// GET /api/profile → { profile } (null before the first save)
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("profile")
    .select("*")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data ? profileFromRow(data) : null });
}

// PUT /api/profile { age, sex, heightIn, weightLb, activityLevel } → { profile, targets }
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseProfile(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid profile", fields: parsed.errors },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("profile")
    .upsert(
      { user_id: auth.user.id, ...profileToRow(parsed.profile) },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    profile: profileFromRow(data),
    targets: roundTargets(targetsForProfile(data)),
  });
}
