import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import {
  parseShoppingPatch,
  ShoppingItemNotFound,
  updateShoppingItem,
} from "@/lib/shopping";

// PATCH /api/shopping-list/:id { checked?, actualPriceCents? } → { item }
// Checks an item off as Jadon shops, and/or records what it really cost so
// later weeks use the real price (US-19).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  const parsed = parseShoppingPatch(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    return NextResponse.json({
      item: await updateShoppingItem(auth.supabase, id, parsed.patch),
    });
  } catch (err) {
    if (!(err instanceof ShoppingItemNotFound)) throw err;
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
