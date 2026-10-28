import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { PlanError, selectCandidate } from "@/lib/plans";

// PATCH /api/candidates/:id { selected: true } → { candidates }
// Picks this candidate for its slot and unselects the others (US-10).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Number((await params).id);
  const body = (await request.json().catch(() => null)) as {
    selected?: unknown;
  } | null;
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }
  // One candidate per slot is always picked, so a pick is only ever swapped.
  if (body?.selected !== true) {
    return NextResponse.json(
      { error: "Send { selected: true } to pick this candidate." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      candidates: await selectCandidate(auth.supabase, id),
    });
  } catch (err) {
    if (!(err instanceof PlanError)) throw err;
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
