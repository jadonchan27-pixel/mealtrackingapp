import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/db/server";

// Reads the session, so render it inside <Suspense>.
export async function UserMenu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="user-menu">
      <span className="user-email">{user?.email}</span>
      <SignOutButton />
    </div>
  );
}
