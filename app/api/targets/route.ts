import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { roundTargets } from "@/lib/profile";
import { targetsForProfile } from "@/lib/targets";

// GET /api/targets → { targets }, or 404 until the profile is saved
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
  if (!data) {
    return NextResponse.json(
      { error: "Save your profile first" },
      { status: 404 },
    );
  }
  return NextResponse.json({
    targets: roundTargets(targetsForProfile(data)),
  });
}
