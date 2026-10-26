import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ResetController,
  type ResetControllerDeps,
  type CacheInvalidator,
} from "./reset-controller.js";
import type { ValidCredentials } from "../domain/models.js";

const VALID_CREDS: ValidCredentials = {
  accessToken: "valid-token-xyz",
  accountId: "acct-test-456",
  expiresAt: 1_900_000_000_000,
};

function makeDeps(overrides: Partial<ResetControllerDeps> = {}): ResetControllerDeps {
  return {
    fetchFn: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    }),
    now: () => 1_700_000_500_000,
    ...overrides,
  };
}

describe("ResetController", () => {
  let mockInvalidator: CacheInvalidator;

  beforeEach(() => {
    mockInvalidator = {
      invalidateCache: vi.fn(),
    };
  });

  describe("guard validations", () => {
    it("should return error when availableCount is 0 without calling API", async () => {
      const deps = makeDeps();
      const controller = new ResetController(mockInvalidator, deps);

      const result = await controller.consume(VALID_CREDS, 0);

      expect(result).toEqual({
        success: false,
        error: "No reset credits available",
      });
      expect(deps.fetchFn).not.toHaveBeenCalled();
      expect(mockInvalidator.invalidateCache).not.toHaveBeenCalled();
    });

    it("should return error when availableCount is negative", async () => {
      const deps = makeDeps();
      const controller = new ResetController(mockInvalidator, deps);

      const result = await controller.consume(VALID_CREDS, -1);

      expect(result.success).toBe(false);
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("successful consumption", () => {
    it("should make POST request with correct URL, headers, and idempotency key", async () => {
      const deps = makeDeps({ now: () => 1_792_430_000_000 });
      const controller = new ResetController(mockInvalidator, deps);

      const result = await controller.consume(VALID_CREDS, 2);

      expect(result.success).toBe(true);
      expect(deps.fetchFn).toHaveBeenCalledTimes(1);

      const [url, init] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe("https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        Authorization: "Bearer valid-token-xyz",
        "ChatGPT-Account-Id": "acct-test-456",
        "User-Agent": "codex",
        Accept: "application/json",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(init.body)).toEqual({
        idempotency_key: "consume-rate-limit-reset-1792430000000",
      });
    });

    it("should invalidate cache when reset is successful", async () => {
      const deps = makeDeps();
      const controller = new ResetController(mockInvalidator, deps);

      const result = await controller.consume(VALID_CREDS, 1);

      expect(result.success).toBe(true);
      expect(mockInvalidator.invalidateCache).toHaveBeenCalledTimes(1);
    });

    it("should omit ChatGPT-Account-Id header when accountId is undefined", async () => {
      const deps = makeDeps();
      const controller = new ResetController(mockInvalidator, deps);

      const credsNoAcct: ValidCredentials = {
        ...VALID_CREDS,
        accountId: undefined,
      };

      await controller.consume(credsNoAcct, 1);

      const [, init] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init.headers).not.toHaveProperty("ChatGPT-Account-Id");
    });
  });

  describe("API error handling", () => {
    it("should handle 400 Bad Request and not invalidate cache", async () => {
      const deps = makeDeps({
        fetchFn: vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ detail: "No credits available" }),
        }),
      });
      const controller = new ResetController(mockInvalidator, deps);

      const result = await controller.consume(VALID_CREDS, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Bad request");
      expect(mockInvalidator.invalidateCache).not.toHaveBeenCalled();
    });

    it("should handle 429 Too Many Requests gracefully", async () => {
      const deps = makeDeps({
        fetchFn: vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ detail: "Rate limit exceeded" }),
        }),
      });
      const controller = new ResetController(mockInvalidator, deps);

      const result = await controller.consume(VALID_CREDS, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("throttled");
      expect(mockInvalidator.invalidateCache).not.toHaveBeenCalled();
    });

    it("should handle generic HTTP error status (e.g. 500)", async () => {
      const deps = makeDeps({
        fetchFn: vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ detail: "Server error" }),
        }),
      });
      const controller = new ResetController(mockInvalidator, deps);

      const result = await controller.consume(VALID_CREDS, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to reset quota window (HTTP 500)");
      expect(mockInvalidator.invalidateCache).not.toHaveBeenCalled();
    });

    it("should handle unexpected network rejections without throwing", async () => {
      const deps = makeDeps({
        fetchFn: vi.fn().mockRejectedValue(new Error("Connection reset by peer")),
      });
      const controller = new ResetController(mockInvalidator, deps);

      const result = await controller.consume(VALID_CREDS, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection reset by peer");
      expect(mockInvalidator.invalidateCache).not.toHaveBeenCalled();
    });
  });
});
