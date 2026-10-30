import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { QUERY_LENGTH, searchItems } from "@/lib/restaurantSearch";
import { createUsdaClient } from "@/lib/services/usda";

// GET /api/restaurant-items?q=big+mac → { items, usdaError }
// Items logged before, then USDA foods, with calories and macros for the
// eat-out form (US-37, TR-31). usdaError is set when USDA couldn't be
// searched; past items still come back.
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < QUERY_LENGTH.min || q.length > QUERY_LENGTH.max) {
    return NextResponse.json(
      {
        error: `Search for ${QUERY_LENGTH.min} to ${QUERY_LENGTH.max} characters.`,
      },
      { status: 400 },
    );
  }
  return NextResponse.json(
    await searchItems(auth.supabase, createUsdaClient(), q),
  );
}
