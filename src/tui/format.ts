import type { AuthStatus, QuotaTelemetry } from "../domain/models.js";

export type QuotaColor = "green" | "yellow" | "red" | "gray";

export interface QuotaBadge {
  text: string;
  color: QuotaColor;
  barText: string;
  filledBar: string;
  emptyBar: string;
  prefixText: string;
  metaText: string;
}

export interface ProgressBarResult {
  filled: string;
  empty: string;
  full: string;
}

export function formatProgressBar(
  usedPercent: number = 0,
  width: number = 24,
): ProgressBarResult {
  const safePercent = Number.isFinite(usedPercent) ? usedPercent : 0;
  const clamped = Math.max(0, Math.min(100, safePercent));
  const filledCount = Math.round((clamped / 100) * width);
  const emptyCount = Math.max(0, width - filledCount);
  const filled = "━".repeat(filledCount);
  const empty = "─".repeat(emptyCount);
  return {
    filled,
    empty,
    full: `${filled}${empty}`,
  };
}

export function formatTimeRemaining(resetsAtMs: number, nowMs: number): string {
  const diffMs = resetsAtMs - nowMs;
  if (diffMs <= 0) {
    return "0m";
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 0) {
    const remainingHours = totalHours % 24;
    return `${totalDays}d ${remainingHours}h`;
  }

  if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    return `${totalHours}h ${remainingMinutes}m`;
  }

  return `${totalMinutes}m`;
}

export function getQuotaSeverity(usedPercent: number): QuotaColor {
  if (usedPercent >= 85) {
    return "red";
  }
  if (usedPercent >= 70) {
    return "yellow";
  }
  return "green";
}

export function formatBadge(
  telemetry: QuotaTelemetry | null,
  authStatus: AuthStatus,
  nowMs: number = Date.now(),
): QuotaBadge {
  switch (authStatus) {
    case "missing-file":
      return {
        text: "Codex · No Auth",
        color: "gray",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · No Auth",
      };
    case "missing-openai":
      return {
        text: "Codex · Off",
        color: "gray",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · Off",
      };
    case "expired":
      return {
        text: "Codex · Expired",
        color: "red",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · Expired",
      };
    case "invalid-schema":
      return {
        text: "Codex · Invalid",
        color: "red",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · Invalid",
      };
    case "valid":
    default:
      break;
  }

  if (!telemetry) {
    return {
      text: "Codex · ...",
      color: "gray",
      barText: "",
      filledBar: "",
      emptyBar: "",
      prefixText: "Codex",
      metaText: " · ...",
    };
  }

  const primary = telemetry.primaryWindow;
  if (!primary) {
    const credits = telemetry.availableResetCredits;
    const bar = formatProgressBar(0, 24);
    return {
      text: `Codex · Active · ⚡ ${credits}`,
      color: "green",
      barText: bar.full,
      filledBar: bar.filled,
      emptyBar: bar.empty,
      prefixText: "Codex",
      metaText: ` · Active · ⚡ ${credits}`,
    };
  }

  const usedRounded = Math.round(primary.usedPercent);
  const timeStr = formatTimeRemaining(primary.resetsAt, nowMs);
  const credits = telemetry.availableResetCredits;
  const color = getQuotaSeverity(usedRounded);
  const bar = formatProgressBar(primary.usedPercent, 24);

  return {
    text: `Codex ${usedRounded}% · ⏳ ${timeStr} · ⚡ ${credits}`,
    color,
    barText: bar.full,
    filledBar: bar.filled,
    emptyBar: bar.empty,
    prefixText: `Codex ${usedRounded}%`,
    metaText: ` · ⏳ ${timeStr} · ⚡ ${credits}`,
  };
}
