import type { AuthStatus, QuotaTelemetry, QuotaWindow } from "../domain/models.js";

export type QuotaColor = "green" | "yellow" | "red" | "gray";

export const ANSI_COLORS = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  reset: "\x1b[39m",
} as const;

export function colorize(text: string, color: QuotaColor): string {
  if (!text) return "";
  const code = ANSI_COLORS[color] ?? ANSI_COLORS.gray;
  return `${code}${text}${ANSI_COLORS.reset}`;
}

export function formatColoredProgressBar(
  usedPercent: number = 0,
  width: number = 10,
  color?: QuotaColor,
): string {
  const bar = formatProgressBar(usedPercent, width);
  const activeColor = color ?? getQuotaSeverity(usedPercent);
  const filledPart = bar.filled ? colorize(bar.filled, activeColor) : "";
  const emptyPart = bar.empty ? colorize(bar.empty, "gray") : "";
  return `${filledPart}${emptyPart}`;
}

export interface WindowBadgeData {
  label: string;
  usedPercent: number;
  color: QuotaColor;
  timeRemaining: string;
  filledBar: string;
  emptyBar: string;
  pctText: string;
  timeText: string;
}

export interface ProgressBarResult {
  filled: string;
  empty: string;
  full: string;
}

export interface PacingStatus {
  text: string;
  color: QuotaColor;
}

export interface QuotaBadge {
  text: string;
  color: QuotaColor;
  credits: number;
  plan: string;
  pacing: PacingStatus;
  primary?: WindowBadgeData;
  weekly?: WindowBadgeData;
  barText?: string;
  filledBar?: string;
  emptyBar?: string;
  prefixText?: string;
  metaText?: string;
}

export function formatPlanType(rawPlan?: string): string {
  const normalize = (p?: string) => {
    if (!p) return "Plus";
    const normalized = p.toLowerCase().trim();
    if (normalized === "plus") return "Plus";
    if (normalized === "pro") return "Pro";
    if (normalized === "team") return "Team";
    if (normalized === "enterprise") return "Enterprise";
    return p.charAt(0).toUpperCase() + p.slice(1);
  };
  return `Codex ${normalize(rawPlan)}`;
}

export function calculatePacing(
  usedPercent: number,
  resetsAt: number,
  windowDurationMs: number = 5 * 3600 * 1000,
  nowMs: number = Date.now(),
): PacingStatus {
  if (usedPercent <= 0) {
    return { text: "Al ritmo previsto", color: "green" };
  }

  if (usedPercent >= 85) {
    return { text: "En riesgo de límite", color: "red" };
  }

  const remainingMs = Math.max(0, resetsAt - nowMs);
  const elapsedMs = Math.max(0, windowDurationMs - remainingMs);
  const elapsedPercent = Math.max(1, (elapsedMs / windowDurationMs) * 100);
  const paceRatio = usedPercent / elapsedPercent;

  if (paceRatio > 1.5 && usedPercent > 50) {
    return { text: "Consumo acelerado", color: "yellow" };
  }

  return { text: "Al ritmo previsto", color: "green" };
}

export function formatProgressBar(
  usedPercent: number = 0,
  width: number = 10,
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

export function formatWindowData(
  window: QuotaWindow | null,
  defaultLabel: string,
  nowMs: number,
  gaugeWidth = 10,
): WindowBadgeData | undefined {
  if (!window) return undefined;

  const usedRounded = Math.round(window.usedPercent);
  const color = getQuotaSeverity(usedRounded);
  const bar = formatProgressBar(window.usedPercent, gaugeWidth);
  const timeStr = formatTimeRemaining(window.resetsAt, nowMs);

  return {
    label: defaultLabel,
    usedPercent: usedRounded,
    color,
    timeRemaining: timeStr,
    filledBar: bar.filled,
    emptyBar: bar.empty,
    pctText: `${String(usedRounded).padStart(3, " ")}%`,
    timeText: timeStr.padStart(6, " "),
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
  const plan = formatPlanType(telemetry?.planType);
  const defaultPacing: PacingStatus = {
    text: "Al ritmo previsto",
    color: "green",
  };

  switch (authStatus) {
    case "missing-file":
      return {
        text: "Codex · No Auth",
        color: "gray",
        credits: 0,
        plan: "Codex",
        pacing: { text: "No Auth", color: "gray" },
        prefixText: "Codex",
        metaText: " · No Auth",
      };
    case "missing-openai":
      return {
        text: "Codex · Off",
        color: "gray",
        credits: 0,
        plan: "Codex",
        pacing: { text: "Off", color: "gray" },
        prefixText: "Codex",
        metaText: " · Off",
      };
    case "expired":
      return {
        text: "Codex · Expired",
        color: "red",
        credits: 0,
        plan: "Codex",
        pacing: { text: "Expired", color: "red" },
        prefixText: "Codex",
        metaText: " · Expired",
      };
    case "invalid-schema":
      return {
        text: "Codex · Invalid",
        color: "red",
        credits: 0,
        plan: "Codex",
        pacing: { text: "Invalid", color: "red" },
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
      credits: 0,
      plan: "Codex",
      pacing: { text: "...", color: "gray" },
      prefixText: "Codex",
      metaText: " · ...",
    };
  }

  const credits = telemetry.availableResetCredits;
  const primary = formatWindowData(telemetry.primaryWindow, "5h", nowMs, 10);
  const weekly = formatWindowData(telemetry.weeklyWindow, "7d", nowMs, 10);

  const mainColor = primary?.color ?? "green";
  const mainUsed = primary?.usedPercent ?? 0;
  const mainTime = primary?.timeRemaining ?? "0m";

  const pacing = telemetry.primaryWindow
    ? calculatePacing(
        telemetry.primaryWindow.usedPercent,
        telemetry.primaryWindow.resetsAt,
        5 * 3600 * 1000,
        nowMs,
      )
    : defaultPacing;

  const pText = primary
    ? `5h ${primary.usedPercent}% · ⏳ ${mainTime}`
    : `Codex · Active`;
  const wText = weekly
    ? ` | 7d ${weekly.usedPercent}% · ⏳ ${weekly.timeRemaining}`
    : "";
  const fullText = `${pText}${wText} · ⚡ ${credits}`;

  return {
    text: fullText,
    color: mainColor,
    credits,
    plan,
    pacing,
    primary,
    weekly,
    barText: primary?.filledBar
      ? `${primary.filledBar}${primary.emptyBar}`
      : "",
    filledBar: primary?.filledBar,
    emptyBar: primary?.emptyBar,
    prefixText: `Codex ${mainUsed}%`,
    metaText: ` · ⏳ ${mainTime} · ⚡ ${credits}`,
  };
}
