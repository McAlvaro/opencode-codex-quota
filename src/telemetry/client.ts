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

      if (!usageRes.ok || !creditsRes.ok) {
        return this.fallbackOrNull();
      }

      const [usageJson, creditsJson] = await Promise.all([
        usageRes.json(),
        creditsRes.json(),
      ]);

      const usageParsed = UsageResponseSchema.safeParse(usageJson);
      const creditsParsed = ResetCreditsResponseSchema.safeParse(creditsJson);

      if (!usageParsed.success || !creditsParsed.success) {
        return this.fallbackOrNull();
      }

      const { primary_window, weekly_window } = usageParsed.data.rate_limit;

      const telemetry: QuotaTelemetry = {
        primaryWindow: primary_window
          ? mapWindowToQuota(primary_window)
          : null,
        weeklyWindow: weekly_window ? mapWindowToQuota(weekly_window) : null,
        availableResetCredits: creditsParsed.data.available_count,
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
