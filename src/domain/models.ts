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

const QuotaWindowResponseSchema = z.object({
  name: z.string(),
  limit: z.number(),
  used: z.number(),
  remaining_percent: z.number(),
  resets_at: z.number(),
});

export const UsageResponseSchema = z.object({
  rate_limit: z.object({
    primary_window: QuotaWindowResponseSchema.optional(),
    weekly_window: QuotaWindowResponseSchema.optional(),
  }),
  plan_type: z.string(),
});

const ResetCreditSchema = z.object({
  id: z.string(),
  type: z.string(),
  expires_at: z.number().nullable(),
  status: z.string(),
});

export const ResetCreditsResponseSchema = z.object({
  available_count: z.number(),
  credits: z.array(ResetCreditSchema),
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
): QuotaWindow {
  return {
    name: raw.name,
    usedPercent: (raw.used / raw.limit) * 100,
    remainingPercent: raw.remaining_percent,
    resetsAt: raw.resets_at,
  };
}
