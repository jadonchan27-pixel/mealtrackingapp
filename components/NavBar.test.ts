import { describe, expect, it } from "vitest";
import { isActive } from "./NavBar";

describe("isActive", () => {
  it("matches Today only on the home page", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/plan", "/")).toBe(false);
  });

  it("matches a section and its subpages", () => {
    expect(isActive("/plan", "/plan")).toBe(true);
    expect(isActive("/plan/2026-11-01", "/plan")).toBe(true);
  });

  it("does not match look-alike paths", () => {
    expect(isActive("/planner", "/plan")).toBe(false);
  });
});
