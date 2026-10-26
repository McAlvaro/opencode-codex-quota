import type {
  ValidCredentials,
  ResetConsumptionResult,
} from "../domain/models.js";

const CONSUME_URL =
  "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume";

export interface CacheInvalidator {
  invalidateCache: () => void;
}

export interface ResetControllerDeps {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  now: () => number;
}

const defaultDeps: ResetControllerDeps = {
  fetchFn: globalThis.fetch.bind(globalThis),
  now: () => Date.now(),
};

export class ResetController {
  constructor(
    private readonly cacheInvalidator?: CacheInvalidator,
    private readonly deps: ResetControllerDeps = defaultDeps,
  ) {}

  async consume(
    credentials: ValidCredentials,
    availableCount: number,
  ): Promise<ResetConsumptionResult> {
    if (availableCount <= 0) {
      return {
        success: false,
        error: "No reset credits available",
      };
    }

    try {
      const headers = this.buildHeaders(credentials);
      const idempotencyKey = `consume-rate-limit-reset-${this.deps.now()}`;

      const res = await this.deps.fetchFn(CONSUME_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ idempotency_key: idempotencyKey }),
      });

      if (!res.ok) {
        if (res.status === 400) {
          return {
            success: false,
            error: "Bad request or no credits available",
          };
        }
        if (res.status === 429) {
          return {
            success: false,
            error: "Rate limit reset endpoint throttled",
          };
        }
        return {
          success: false,
          error: `Failed to reset quota window (HTTP ${res.status})`,
        };
      }

      this.cacheInvalidator?.invalidateCache();

      return {
        success: true,
        message: "Quota window reset successfully",
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Network error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private buildHeaders(credentials: ValidCredentials): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.accessToken}`,
      "User-Agent": "codex",
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (credentials.accountId) {
      headers["ChatGPT-Account-Id"] = credentials.accountId;
    }

    return headers;
  }
}
