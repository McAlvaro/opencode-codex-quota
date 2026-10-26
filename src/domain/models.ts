import { z } from "zod";

// ── Auth Store Schema ──────────────────────────────────────────────

export const OpenAICredentialsSchema = z.object({
  type: z.literal("oauth"),
  access: z.string().min(1),
  accountId: z.string().optional(),
  refresh: z.string().optional(),
  expires: z.number(),
});

export const AuthStoreSchema = z.object({
  openai: OpenAICredentialsSchema.optional(),
});

export type OpenAICredentials = z.infer<typeof OpenAICredentialsSchema>;
export type AuthStore = z.infer<typeof AuthStoreSchema>;

// ── Auth Result ────────────────────────────────────────────────────

export type AuthStatus =
  | "valid"
  | "missing-file"
  | "missing-openai"
  | "expired"
  | "invalid-schema";

export type AuthResult =
  | { status: "valid"; credentials: ValidCredentials }
  | { status: Exclude<AuthStatus, "valid"> };

export interface ValidCredentials {
  accessToken: string;
  accountId: string | undefined;
  expiresAt: number;
}

// ── Quota Domain Models ────────────────────────────────────────────

export interface QuotaWindow {
  name: string;
  usedPercent: number;
  remainingPercent: number;
  resetsAt: number;
}

export interface QuotaTelemetry {
  primaryWindow: QuotaWindow | null;
  weeklyWindow: QuotaWindow | null;
  availableResetCredits: number;
  lastUpdated: number;
}

// ── API Response Schemas ───────────────────────────────────────────

export const QuotaWindowResponseSchema = z.object({
  name: z.string().optional(),
  used_percent: z.number().optional(),
  limit_window_seconds: z.number().optional(),
  reset_after_seconds: z.number().optional(),
  reset_at: z.number().optional(),
  // Fallbacks for legacy/alternative format
  limit: z.number().optional(),
  used: z.number().optional(),
  remaining_percent: z.number().optional(),
  resets_at: z.number().optional(),
});

export const UsageResponseSchema = z.object({
  rate_limit: z.object({
    allowed: z.boolean().optional(),
    limit_reached: z.boolean().optional(),
    primary_window: QuotaWindowResponseSchema.nullable().optional(),
    secondary_window: QuotaWindowResponseSchema.nullable().optional(),
    weekly_window: QuotaWindowResponseSchema.nullable().optional(),
  }),
  rate_limit_reset_credits: z
    .object({
      available_count: z.number().optional(),
      applicable_available_count: z.number().optional(),
    })
    .nullable()
    .optional(),
  plan_type: z.string().optional(),
});

export const ResetCreditsResponseSchema = z.object({
  available_count: z.number().optional().default(0),
  credits: z.array(z.record(z.unknown())).optional().default([]),
  total_earned_count: z.number().optional(),
  immediate_reset_purchase_eligible: z.boolean().optional(),
  history_enabled: z.boolean().optional(),
});

export type UsageResponse = z.infer<typeof UsageResponseSchema>;
export type ResetCreditsResponse = z.infer<typeof ResetCreditsResponseSchema>;

// ── Reset Models ───────────────────────────────────────────────────

export interface ResetConsumptionResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ── Mappers ────────────────────────────────────────────────────────

export function mapWindowToQuota(
  raw: z.infer<typeof QuotaWindowResponseSchema>,
  defaultName = "Window",
  nowMs: number = Date.now(),
): QuotaWindow {
  const name = raw.name ?? defaultName;

  let usedPercent = 0;
  if (typeof raw.used_percent === "number") {
    usedPercent = raw.used_percent;
  } else if (
    typeof raw.used === "number" &&
    typeof raw.limit === "number" &&
    raw.limit > 0
  ) {
    usedPercent = (raw.used / raw.limit) * 100;
  }

  let remainingPercent = 100 - usedPercent;
  if (typeof raw.remaining_percent === "number") {
    remainingPercent = raw.remaining_percent;
  }

  let resetsAt = nowMs;
  const rawResetAt = raw.reset_at ?? raw.resets_at;
  if (typeof rawResetAt === "number") {
    resetsAt = rawResetAt > 1e11 ? rawResetAt : rawResetAt * 1000;
  } else if (typeof raw.reset_after_seconds === "number") {
    resetsAt = nowMs + raw.reset_after_seconds * 1000;
  }

  return {
    name,
    usedPercent,
    remainingPercent: Math.max(0, Math.min(100, remainingPercent)),
    resetsAt,
  };
}
