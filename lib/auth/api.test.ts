import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { requireUser } = await import("./api");

describe("requireUser", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_EMAIL", "me@example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    getUser.mockReset();
  });

  it("returns the allowed user", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "me@example.com" } },
    });

    const result = await requireUser();

    expect(result.ok).toBe(true);
    expect(result.ok && result.user.id).toBe("u1");
  });

  it("responds 401 when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await requireUser();

    expect(result.ok).toBe(false);
    expect(!result.ok && result.response.status).toBe(401);
  });

  it("responds 403 for another account", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u2", email: "other@example.com" } },
    });

    const result = await requireUser();

    expect(result.ok).toBe(false);
    expect(!result.ok && result.response.status).toBe(403);
  });
});
