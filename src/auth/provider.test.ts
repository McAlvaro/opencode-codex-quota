import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenCodeAuthProvider, type AuthDeps } from "./provider.js";

function makeDeps(overrides: Partial<AuthDeps> = {}): AuthDeps {
  return {
    readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

const VALID_AUTH = JSON.stringify({
  openai: {
    type: "oauth",
    access: "eyJhbGciOi...",
    accountId: "646663a5-5858-4b7e-9fa5-fc427d62f4f8",
    refresh: "v1.mc...",
    expires: 1_800_000_000_000,
  },
});

describe("OpenCodeAuthProvider", () => {
  let provider: OpenCodeAuthProvider;

  describe("missing auth file", () => {
    beforeEach(() => {
      const deps = makeDeps();
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);
    });

    it("should return missing-file when file does not exist", async () => {
      const result = await provider.getCredentials();
      expect(result).toEqual({ status: "missing-file" });
    });
  });

  describe("missing .openai key", () => {
    it("should return missing-openai when openai key is absent", async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(JSON.stringify({})),
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result).toEqual({ status: "missing-openai" });
    });

    it("should return missing-openai when openai is null", async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(JSON.stringify({ openai: null })),
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result).toEqual({ status: "missing-openai" });
    });
  });

  describe("invalid schema", () => {
    it("should return invalid-schema when type is not oauth", async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify({
            openai: {
              type: "api-key",
              access: "sk-...",
              expires: 1_800_000_000_000,
            },
          }),
        ),
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result).toEqual({ status: "invalid-schema" });
    });

    it("should return invalid-schema when access is empty", async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify({
            openai: {
              type: "oauth",
              access: "",
              expires: 1_800_000_000_000,
            },
          }),
        ),
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result).toEqual({ status: "invalid-schema" });
    });

    it("should return invalid-schema when JSON is malformed", async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue("{not valid json"),
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result).toEqual({ status: "invalid-schema" });
    });
  });

  describe("expired token", () => {
    it("should return expired when token has already expired", async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify({
            openai: {
              type: "oauth",
              access: "eyJ...",
              expires: 1_699_999_000_000, // before now
            },
          }),
        ),
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result).toEqual({ status: "expired" });
    });

    it("should return expired when token expires within 30s buffer", async () => {
      const now = 1_700_000_000_000;
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify({
            openai: {
              type: "oauth",
              access: "eyJ...",
              expires: now + 20_000, // 20s from now, within 30s buffer
            },
          }),
        ),
        now: () => now,
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result).toEqual({ status: "expired" });
    });
  });

  describe("valid credentials", () => {
    it("should return valid credentials with all fields", async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(VALID_AUTH),
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result).toEqual({
        status: "valid",
        credentials: {
          accessToken: "eyJhbGciOi...",
          accountId: "646663a5-5858-4b7e-9fa5-fc427d62f4f8",
          expiresAt: 1_800_000_000_000,
        },
      });
    });

    it("should return valid with undefined accountId when absent", async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify({
            openai: {
              type: "oauth",
              access: "eyJ...",
              expires: 1_800_000_000_000,
            },
          }),
        ),
      });
      provider = new OpenCodeAuthProvider("/fake/auth.json", deps);

      const result = await provider.getCredentials();
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.credentials.accountId).toBeUndefined();
      }
    });
  });
});
