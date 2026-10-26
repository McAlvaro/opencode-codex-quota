import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CodexTelemetryClient,
  type TelemetryDeps,
} from "./client.js";
import type { ValidCredentials, QuotaTelemetry } from "../domain/models.js";

const VALID_CREDS: ValidCredentials = {
  accessToken: "eyJ...",
  accountId: "acct-123",
  expiresAt: 1_900_000_000_000,
};

const USAGE_RESPONSE = {
  rate_limit: {
    primary_window: {
      name: "5-hour",
      limit: 100,
      used: 42.5,
      remaining_percent: 57.5,
      resets_at: 1_792_439_656_000,
    },
    weekly_window: {
      name: "weekly",
      limit: 1000,
      used: 280,
      remaining_percent: 72.0,
      resets_at: 1_792_982_400_000,
    },
  },
  plan_type: "plus",
};

const CREDITS_RESPONSE = {
  available_count: 1,
  credits: [
    {
      id: "crd_01hxyz",
      type: "weekly_reset",
      expires_at: null,
      status: "available",
    },
  ],
};

function mockFetch(
  usageStatus = 200,
  creditsStatus = 200,
  usageBody = USAGE_RESPONSE,
  creditsBody = CREDITS_RESPONSE,
): TelemetryDeps["fetchFn"] {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes("/wham/usage")) {
      return Promise.resolve({
        ok: usageStatus === 200,
        status: usageStatus,
        json: () => Promise.resolve(usageBody),
      });
    }
    if (url.includes("/wham/rate-limit-reset-credits")) {
      return Promise.resolve({
        ok: creditsStatus === 200,
        status: creditsStatus,
        json: () => Promise.resolve(creditsBody),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => ({}) });
  });
}

function makeDeps(overrides: Partial<TelemetryDeps> = {}): TelemetryDeps {
  return {
    fetchFn: mockFetch(),
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

describe("CodexTelemetryClient", () => {
  let client: CodexTelemetryClient;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful fetch", () => {
    beforeEach(() => {
      client = new CodexTelemetryClient(makeDeps());
    });

    it("should fetch and merge usage + credits into QuotaTelemetry", async () => {
      const result = await client.getTelemetry(VALID_CREDS);

      expect(result).not.toBeNull();
      const telemetry = result as QuotaTelemetry;
      expect(telemetry.primaryWindow).toEqual({
        name: "5-hour",
        usedPercent: 42.5,
        remainingPercent: 57.5,
        resetsAt: 1_792_439_656_000,
      });
      expect(telemetry.weeklyWindow).toEqual({
        name: "weekly",
        usedPercent: expect.closeTo(28, 5),
        remainingPercent: 72.0,
        resetsAt: 1_792_982_400_000,
      });
      expect(telemetry.availableResetCredits).toBe(1);
      expect(telemetry.lastUpdated).toBe(1_700_000_000_000);
    });

    it("should send correct headers in requests", async () => {
      const fetchFn = mockFetch();
      client = new CodexTelemetryClient(makeDeps({ fetchFn }));
      await client.getTelemetry(VALID_CREDS);

      expect(fetchFn).toHaveBeenCalledTimes(2);

      const [, usageInit] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(usageInit.headers).toEqual({
        Authorization: "Bearer eyJ...",
        "ChatGPT-Account-Id": "acct-123",
        "User-Agent": "codex",
        Accept: "application/json",
      });
    });
  });

  describe("TTL cache", () => {
    it("should return cached data within TTL window", async () => {
      const fetchFn = mockFetch();
      let currentTime = 1_700_000_000_000;
      const deps = makeDeps({ fetchFn, now: () => currentTime });
      client = new CodexTelemetryClient(deps);

      await client.getTelemetry(VALID_CREDS);
      expect(fetchFn).toHaveBeenCalledTimes(2);

      // Advance 30s (within 60s TTL)
      currentTime += 30_000;
      await client.getTelemetry(VALID_CREDS);
      // Should NOT have made new requests
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("should refetch after TTL expires", async () => {
      const fetchFn = mockFetch();
      let currentTime = 1_700_000_000_000;
      const deps = makeDeps({ fetchFn, now: () => currentTime });
      client = new CodexTelemetryClient(deps);

      await client.getTelemetry(VALID_CREDS);
      expect(fetchFn).toHaveBeenCalledTimes(2);

      // Advance 61s (past 60s TTL)
      currentTime += 61_000;
      await client.getTelemetry(VALID_CREDS);
      expect(fetchFn).toHaveBeenCalledTimes(4);
    });

    it("should bypass cache when force=true", async () => {
      const fetchFn = mockFetch();
      const deps = makeDeps({ fetchFn });
      client = new CodexTelemetryClient(deps);

      await client.getTelemetry(VALID_CREDS);
      await client.getTelemetry(VALID_CREDS, true);
      expect(fetchFn).toHaveBeenCalledTimes(4);
    });

    it("should clear cache on invalidate()", async () => {
      const fetchFn = mockFetch();
      const deps = makeDeps({ fetchFn });
      client = new CodexTelemetryClient(deps);

      await client.getTelemetry(VALID_CREDS);
      client.invalidateCache();
      await client.getTelemetry(VALID_CREDS);
      expect(fetchFn).toHaveBeenCalledTimes(4);
    });
  });

  describe("error handling", () => {
    it("should return null on HTTP 401", async () => {
      const deps = makeDeps({ fetchFn: mockFetch(401, 401) });
      client = new CodexTelemetryClient(deps);

      const result = await client.getTelemetry(VALID_CREDS);
      expect(result).toBeNull();
    });

    it("should return null on HTTP 429", async () => {
      const deps = makeDeps({ fetchFn: mockFetch(429, 429) });
      client = new CodexTelemetryClient(deps);

      const result = await client.getTelemetry(VALID_CREDS);
      expect(result).toBeNull();
    });

    it("should return null on network failure", async () => {
      const deps = makeDeps({
        fetchFn: vi.fn().mockRejectedValue(new Error("Network error")),
      });
      client = new CodexTelemetryClient(deps);

      const result = await client.getTelemetry(VALID_CREDS);
      expect(result).toBeNull();
    });

    it("should return last cached data on error if cache exists", async () => {
      const fetchFn = mockFetch();
      let currentTime = 1_700_000_000_000;
      const deps = makeDeps({ fetchFn, now: () => currentTime });
      client = new CodexTelemetryClient(deps);

      // First call succeeds
      const first = await client.getTelemetry(VALID_CREDS);
      expect(first).not.toBeNull();

      // Expire cache and make fetch fail
      currentTime += 61_000;
      (deps.fetchFn as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

      const second = await client.getTelemetry(VALID_CREDS);
      // Should return stale cache rather than null
      expect(second).not.toBeNull();
      expect(second?.lastUpdated).toBe(1_700_000_000_000);
    });

    it("should handle malformed usage response gracefully", async () => {
      const deps = makeDeps({
        fetchFn: mockFetch(200, 200, { garbage: true } as any, CREDITS_RESPONSE),
      });
      client = new CodexTelemetryClient(deps);

      const result = await client.getTelemetry(VALID_CREDS);
      expect(result).toBeNull();
    });
  });

  describe("missing accountId", () => {
    it("should omit ChatGPT-Account-Id header when accountId is undefined", async () => {
      const fetchFn = mockFetch();
      const deps = makeDeps({ fetchFn });
      client = new CodexTelemetryClient(deps);

      const credsNoAccount: ValidCredentials = {
        ...VALID_CREDS,
        accountId: undefined,
      };
      await client.getTelemetry(credsNoAccount);

      const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init.headers).not.toHaveProperty("ChatGPT-Account-Id");
    });
  });
});
