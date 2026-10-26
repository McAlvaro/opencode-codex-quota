import type { AuthStatus, QuotaTelemetry } from "../domain/models.js";

export type QuotaColor = "green" | "yellow" | "red" | "gray";

export interface QuotaBadge {
  text: string;
  color: QuotaColor;
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
      return { text: "[Codex: No Auth]", color: "gray" };
    case "missing-openai":
      return { text: "[Codex: Off]", color: "gray" };
    case "expired":
      return { text: "[Codex: Expired]", color: "red" };
    case "invalid-schema":
      return { text: "[Codex: Invalid]", color: "red" };
    case "valid":
    default:
      break;
  }

  if (!telemetry) {
    return { text: "[Codex: ...]", color: "gray" };
  }

  const primary = telemetry.primaryWindow;
  if (!primary) {
    return {
      text: `[Codex: Active | ⚡ ${telemetry.availableResetCredits}]`,
      color: "green",
    };
  }

  const usedRounded = Math.round(primary.usedPercent);
  const timeStr = formatTimeRemaining(primary.resetsAt, nowMs);
  const credits = telemetry.availableResetCredits;
  const color = getQuotaSeverity(usedRounded);

  return {
    text: `[Codex: ${usedRounded}% | ⏳ ${timeStr} | ⚡ ${credits}]`,
    color,
  };
}
