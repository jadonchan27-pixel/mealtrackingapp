import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows the redirect with a GET.
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
