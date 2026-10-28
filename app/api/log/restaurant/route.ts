import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { addRestaurantEntry, parseRestaurant } from "@/lib/log";
import { isIsoDate } from "@/lib/weights";

// POST /api/log/restaurant
// { date, slot, restaurantName?, itemName, amount?, kcal, proteinG, carbsG,
//   fatG } → { day }
// Replaces the slot's planned meal with a restaurant item, counted as eaten
// (US-24, US-25). Calories and macros are for the whole item; amount is how
// much of it was eaten (1 by default).
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = parseRestaurant(
    await request.json().catch(() => null),
    isIsoDate,
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  return NextResponse.json({
    day: await addRestaurantEntry(auth.supabase, parsed.input),
  });
}
