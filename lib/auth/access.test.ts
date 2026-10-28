import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decideAccess } from "./access";

describe("decideAccess", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_EMAIL", "me@example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("signed out", () => {
    it("sends pages to sign-in", () => {
      expect(decideAccess("/", null)).toBe("sign-in");
      expect(decideAccess("/profile", null)).toBe("sign-in");
    });

    it("rejects API requests", () => {
      expect(decideAccess("/api/profile", null)).toBe("unauthorized");
      expect(decideAccess("/api", null)).toBe("unauthorized");
    });

    it("allows the sign-in flow", () => {
      expect(decideAccess("/sign-in", null)).toBe("allow");
      expect(decideAccess("/auth/callback", null)).toBe("allow");
      expect(decideAccess("/auth/sign-out", null)).toBe("allow");
    });

    it("does not treat look-alike paths as public or API", () => {
      expect(decideAccess("/sign-in-extra", null)).toBe("sign-in");
      expect(decideAccess("/apis", null)).toBe("sign-in");
    });
  });

  describe("signed in as the allowed user", () => {
    it("allows pages and API requests", () => {
      expect(decideAccess("/", "me@example.com")).toBe("allow");
      expect(decideAccess("/api/profile", "me@example.com")).toBe("allow");
    });

    it("redirects away from the sign-in page", () => {
      expect(decideAccess("/sign-in", "me@example.com")).toBe("home");
    });
  });

  describe("signed in as another account", () => {
    it("refuses pages, including public ones", () => {
      expect(decideAccess("/", "other@example.com")).toBe("refuse");
      expect(decideAccess("/sign-in", "other@example.com")).toBe("refuse");
    });

    it("forbids API requests", () => {
      expect(decideAccess("/api/profile", "other@example.com")).toBe(
        "forbidden",
      );
    });
  });
});
