import type { TuiDialogSelectOption } from "@opencode-ai/plugin/tui";
import type { QuotaTelemetry } from "../domain/models.js";
import {
  formatTimeRemaining,
  formatPlanType,
  calculatePacing,
  formatProgressBar,
} from "./format.js";

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

  const plan = formatPlanType(telemetry.planType);
  const pacing = telemetry.primaryWindow
    ? calculatePacing(
        telemetry.primaryWindow.usedPercent,
        telemetry.primaryWindow.resetsAt,
        5 * 3600 * 1000,
        now,
      )
    : { text: "Al ritmo previsto", color: "green" };

  // Plan & Pacing summary item
  options.push({
    title: `Suscripción: ${plan} · ${pacing.text}`,
    value: "plan_status",
    description: `Estado: ${pacing.text} · ${telemetry.availableResetCredits} crédito(s) disponibles`,
    category: "Moshi Telemetry",
    disabled: true,
  });

  // Primary 5-hour window item
  if (telemetry.primaryWindow) {
    const pw = telemetry.primaryWindow;
    const timeRemaining = formatTimeRemaining(pw.resetsAt, now);
    const bar = formatProgressBar(pw.usedPercent, 14);
    options.push({
      title: `5h Window: ${pw.usedPercent.toFixed(1)}%  ${bar.full}`,
      value: "primary_window",
      description: `Resetea en ${timeRemaining} (Restante: ${pw.remainingPercent.toFixed(1)}%)`,
      category: "Ventanas de Cuota",
      disabled: true,
    });
  }

  // Weekly window item
  if (telemetry.weeklyWindow) {
    const ww = telemetry.weeklyWindow;
    const timeRemaining = formatTimeRemaining(ww.resetsAt, now);
    const bar = formatProgressBar(ww.usedPercent, 14);
    options.push({
      title: `7d Window: ${ww.usedPercent.toFixed(1)}%  ${bar.full}`,
      value: "weekly_window",
      description: `Resetea en ${timeRemaining} (Restante: ${ww.remainingPercent.toFixed(1)}%)`,
      category: "Ventanas de Cuota",
      disabled: true,
    });
  }

  // Redeem Reset Credit option
  const credits = telemetry.availableResetCredits;
  options.push({
    title: "⚡ Canjear 1 Crédito de Reseteo",
    value: "consume",
    description:
      credits > 0
        ? `${credits} crédito${credits === 1 ? "" : "s"} disponible${credits === 1 ? "" : "s"}`
        : "Sin créditos de reseteo disponibles en esta cuenta",
    category: "Acciones",
    disabled: credits <= 0,
    onSelect: ctx.onConsume,
  });

  // Close option
  options.push({
    title: "Cerrar",
    value: "close",
    category: "Acciones",
    onSelect: ctx.onClose,
  });

  return options;
}
