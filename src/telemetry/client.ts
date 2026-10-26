import {
  UsageResponseSchema,
  ResetCreditsResponseSchema,
  mapWindowToQuota,
  type ValidCredentials,
  type QuotaTelemetry,
} from "../domain/models.js";

const BASE_URL = "https://chatgpt.com/backend-api";
const CACHE_TTL_MS = 60_000;

export interface TelemetryDeps {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  now: () => number;
}

const defaultDeps: TelemetryDeps = {
  fetchFn: globalThis.fetch.bind(globalThis),
  now: () => Date.now(),
};

interface CacheEntry {
  data: QuotaTelemetry;
  timestamp: number;
}

export class CodexTelemetryClient {
  private cache: CacheEntry | null = null;

  constructor(private readonly deps: TelemetryDeps = defaultDeps) {}

  async getTelemetry(
    credentials: ValidCredentials,
    force = false,
  ): Promise<QuotaTelemetry | null> {
    const now = this.deps.now();

    if (!force && this.cache && now - this.cache.timestamp < CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      const headers = this.buildHeaders(credentials);

      const [usageRes, creditsRes] = await Promise.all([
        this.deps.fetchFn(`${BASE_URL}/wham/usage`, { headers }),
        this.deps.fetchFn(`${BASE_URL}/wham/rate-limit-reset-credits`, {
          headers,
        }),
      ]);

      if (!usageRes.ok) {
        return this.fallbackOrNull();
      }

      const usageJson = await usageRes.json();
      const usageParsed = UsageResponseSchema.safeParse(usageJson);

      if (!usageParsed.success) {
        return this.fallbackOrNull();
      }

      let availableCredits = 0;
      if (creditsRes.ok) {
        try {
          const creditsJson = await creditsRes.json();
          const creditsParsed =
            ResetCreditsResponseSchema.safeParse(creditsJson);
          if (creditsParsed.success) {
            availableCredits = creditsParsed.data.available_count;
          }
        } catch {
          // Fall back to usageParsed credits
        }
      }

      if (
        availableCredits === 0 &&
        typeof usageParsed.data.rate_limit_reset_credits?.available_count ===
          "number"
      ) {
        availableCredits =
          usageParsed.data.rate_limit_reset_credits.available_count;
      }

      const { primary_window, secondary_window, weekly_window } =
        usageParsed.data.rate_limit;
      const weekly = secondary_window ?? weekly_window;

      const telemetry: QuotaTelemetry = {
        primaryWindow: primary_window
          ? mapWindowToQuota(primary_window, "5h Rolling Window", now)
          : null,
        weeklyWindow: weekly
          ? mapWindowToQuota(weekly, "Weekly Limit", now)
          : null,
        availableResetCredits: availableCredits,
        lastUpdated: now,
      };

      this.cache = { data: telemetry, timestamp: now };
      return telemetry;
    } catch {
      return this.fallbackOrNull();
    }
  }

  invalidateCache(): void {
    this.cache = null;
  }

  private buildHeaders(
    credentials: ValidCredentials,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.accessToken}`,
      "User-Agent": "codex",
      Accept: "application/json",
    };

    if (credentials.accountId) {
      headers["ChatGPT-Account-Id"] = credentials.accountId;
    }

    return headers;
  }

  private fallbackOrNull(): QuotaTelemetry | null {
    return this.cache?.data ?? null;
  }
}
