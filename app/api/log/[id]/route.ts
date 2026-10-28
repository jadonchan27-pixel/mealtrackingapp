import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { LogEntryNotFound, parseLogPatch, updateLogEntry } from "@/lib/log";

// PATCH /api/log/:id { status?, portion? } → { entry }
// Confirms an entry as eaten or marks it skipped, and/or changes the portion
// (US-21, US-22).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  const parsed = parseLogPatch(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    return NextResponse.json({
      entry: await updateLogEntry(auth.supabase, id, parsed.patch),
    });
  } catch (err) {
    if (!(err instanceof LogEntryNotFound)) throw err;
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
