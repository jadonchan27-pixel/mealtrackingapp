import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowedEmail, isAllowedEmail } from "./allowed";

describe("isAllowedEmail", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_EMAIL", " Me@Example.com ");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the allowed email in any case", () => {
    expect(isAllowedEmail("me@example.com")).toBe(true);
    expect(isAllowedEmail("ME@EXAMPLE.COM")).toBe(true);
  });

  it("refuses other emails and missing emails", () => {
    expect(isAllowedEmail("someone@example.com")).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
  });

  it("names the missing variable", () => {
    vi.stubEnv("ALLOWED_EMAIL", "");
    expect(() => allowedEmail()).toThrow("ALLOWED_EMAIL");
  });
});
