import { Suspense } from "react";
import { NavBar } from "@/components/NavBar";
import { UserMenu } from "@/components/UserMenu";

// Shell for every signed-in page: header, page content and navigation.
// On phones the navigation is a bottom tab bar; on wider screens it sits under the header.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="shell">
      <header className="header">
        <span className="app-name">Meal Tracker</span>
        <Suspense fallback={null}>
          <UserMenu />
        </Suspense>
      </header>
      <NavBar />
      <main className="content">{children}</main>
    </div>
  );
}
