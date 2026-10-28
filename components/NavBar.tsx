"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/", label: "Today", icon: "🍽️" },
  { href: "/plan", label: "Plan", icon: "📅" },
  { href: "/shopping", label: "Shopping", icon: "🛒" },
  { href: "/weight", label: "Weight", icon: "⚖️" },
  { href: "/profile", label: "Profile", icon: "👤" },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  return <NavLinks pathname={usePathname()} />;
}

// The links with the current section marked. The layout also shows them
// unmarked while a page with URL params (a recipe) streams in.
export function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="nav" aria-label="Main">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className="nav-link"
            aria-current={active ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              {icon}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
