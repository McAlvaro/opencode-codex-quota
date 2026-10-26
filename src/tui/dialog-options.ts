import type { TuiDialogSelectOption } from "@opencode-ai/plugin/tui";
import type { QuotaTelemetry } from "../domain/models.js";
import { formatTimeRemaining } from "./format.js";

export interface BuildOptionsContext {
  nowMs?: number;
  onConsume: () => void;
  onClose: () => void;
}

export function buildQuotaDialogOptions(
  telemetry: QuotaTelemetry,
  ctx: BuildOptionsContext,
): TuiDialogSelectOption<string>[] {
  const now = ctx.nowMs ?? Date.now();
  const options: TuiDialogSelectOption<string>[] = [];

  // Primary 5-hour window item
  if (telemetry.primaryWindow) {
    const pw = telemetry.primaryWindow;
    const timeRemaining = formatTimeRemaining(pw.resetsAt, now);
    options.push({
      title: `5-Hour Window: ${pw.usedPercent.toFixed(1)}% used`,
      value: "primary_window",
      description: `Resets in ${timeRemaining} (Remaining: ${pw.remainingPercent.toFixed(1)}%)`,
      category: "Telemetry",
      disabled: true,
    });
  }

  // Weekly window item
  if (telemetry.weeklyWindow) {
    const ww = telemetry.weeklyWindow;
    const timeRemaining = formatTimeRemaining(ww.resetsAt, now);
    options.push({
      title: `Weekly Limit: ${ww.usedPercent.toFixed(1)}% used`,
      value: "weekly_window",
      description: `Resets in ${timeRemaining} (Remaining: ${ww.remainingPercent.toFixed(1)}%)`,
      category: "Telemetry",
      disabled: true,
    });
  }

  // Redeem Reset Credit option
  const credits = telemetry.availableResetCredits;
  options.push({
    title: "⚡ Redeem 1 Reset Credit",
    value: "consume",
    description:
      credits > 0
        ? `${credits} credit${credits === 1 ? "" : "s"} available`
        : "No reset credits available",
    category: "Actions",
    disabled: credits <= 0,
    onSelect: ctx.onConsume,
  });

  // Close option
  options.push({
    title: "Close",
    value: "close",
    category: "Actions",
    onSelect: ctx.onClose,
  });

  return options;
}
