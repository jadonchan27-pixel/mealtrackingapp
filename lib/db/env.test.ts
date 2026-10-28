import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "./env";

describe("Supabase env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns values that are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");

    expect(supabaseUrl()).toBe("https://example.supabase.co");
    expect(supabaseAnonKey()).toBe("anon");
    expect(supabaseServiceRoleKey()).toBe("service");
  });

  it("names the missing variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    expect(() => supabaseUrl()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});
