import type { TuiDialogSelectOption } from "@opencode-ai/plugin/tui";
import type { QuotaTelemetry } from "../domain/models.js";
import {
  formatTimeRemaining,
  formatPlanType,
  calculatePacing,
  formatProgressBar,
} from "./format.js";

export interface BuildQuotaOptionsContext {
  nowMs?: number;
  onConsume: () => void;
  onRefresh?: () => void;
  onClose: () => void;
}

export interface BuildUsageOptionsContext {
  nowMs?: number;
  onRefresh?: () => void;
  onClose: () => void;
}

/**
 * Builds options for `/codex-quota` (Cuota y Límites):
 * Focused on capacity, visual gauges, remaining headroom, and reset redemption.
 */
export function buildQuotaCardOptions(
  telemetry: QuotaTelemetry,
  ctx: BuildQuotaOptionsContext,
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

  // Plan & Pacing summary
  options.push({
    title: `Plan ${plan} · ${pacing.text}`,
    value: "quota_plan",
    description: "Ritmo de consumo saludable en tus ventanas",
    category: "Plan & Ritmo",
    disabled: false,
    onSelect: () => {},
  });

  // Primary 5-hour window
  if (telemetry.primaryWindow) {
    const pw = telemetry.primaryWindow;
    const timeRemaining = formatTimeRemaining(pw.resetsAt, now);
    const bar = formatProgressBar(pw.usedPercent, 10);
    options.push({
      title: `5h: ${pw.usedPercent.toFixed(0).padStart(2, " ")}% ${bar.full}`,
      value: "quota_5h",
      description: `Resetea en ${timeRemaining} · Libre: ${pw.remainingPercent.toFixed(0)}%`,
      category: "Límites de Cuota",
      disabled: false,
      onSelect: () => {},
    });
  }

  // Weekly window
  if (telemetry.weeklyWindow) {
    const ww = telemetry.weeklyWindow;
    const timeRemaining = formatTimeRemaining(ww.resetsAt, now);
    const bar = formatProgressBar(ww.usedPercent, 10);
    options.push({
      title: `7d: ${ww.usedPercent.toFixed(0).padStart(2, " ")}% ${bar.full}`,
      value: "quota_7d",
      description: `Resetea en ${timeRemaining} · Libre: ${ww.remainingPercent.toFixed(0)}%`,
      category: "Límites de Cuota",
      disabled: false,
      onSelect: () => {},
    });
  }

  // Redeem Reset Credit action
  const credits = telemetry.availableResetCredits;
  options.push({
    title: "⚡ Canjear 1 Crédito de Reseteo",
    value: "consume",
    description:
      credits > 0
        ? `${credits} crédito(s) disponibles para resetear 5h`
        : "Sin créditos de reseteo disponibles en esta cuenta",
    category: "Acciones",
    disabled: false,
    onSelect: ctx.onConsume,
  });

  // Refresh action
  if (ctx.onRefresh) {
    options.push({
      title: "🔄 Sincronizar cuota ahora",
      value: "refresh",
      description: "Actualizar límites y métricas con ChatGPT",
      category: "Acciones",
      disabled: false,
      onSelect: ctx.onRefresh,
    });
  }

  // Close option
  options.push({
    title: "✕ Cerrar",
    value: "close",
    category: "Acciones",
    disabled: false,
    onSelect: ctx.onClose,
  });

  return options;
}

/**
 * Builds options for `/codex-usage` (Telemetría y Diagnóstico de Consumo):
 * Focused on burn rate, analytical percentages, system health, and sync latency.
 */
export function buildUsageCardOptions(
  telemetry: QuotaTelemetry,
  ctx: BuildUsageOptionsContext,
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

  // Burn Rate / Pacing analysis
  const pw = telemetry.primaryWindow;
  options.push({
    title: `Velocidad: ${pacing.text}`,
    value: "usage_pacing",
    description: pw
      ? `Ventana 5h: ${pw.usedPercent.toFixed(1)}% consumido`
      : "Sin datos activos de ventana",
    category: "Análisis de Consumo",
    disabled: false,
    onSelect: () => {},
  });

  // Detailed 5h Window
  if (pw) {
    const timeRemaining = formatTimeRemaining(pw.resetsAt, now);
    options.push({
      title: `Ventana 5 Horas: ${pw.usedPercent.toFixed(1)}%`,
      value: "usage_5h",
      description: `Libre: ${pw.remainingPercent.toFixed(1)}% · Reset en ${timeRemaining}`,
      category: "Desglose de Telemetría",
      disabled: false,
      onSelect: () => {},
    });
  }

  // Detailed Weekly Window
  if (telemetry.weeklyWindow) {
    const ww = telemetry.weeklyWindow;
    const timeRemaining = formatTimeRemaining(ww.resetsAt, now);
    options.push({
      title: `Ventana 7 Días: ${ww.usedPercent.toFixed(1)}%`,
      value: "usage_7d",
      description: `Libre: ${ww.remainingPercent.toFixed(1)}% · Reset en ${timeRemaining}`,
      category: "Desglose de Telemetría",
      disabled: false,
      onSelect: () => {},
    });
  }

  // Emergency reset credits pool
  options.push({
    title: `Créditos de Emergencia: ${telemetry.availableResetCredits}`,
    value: "usage_credits",
    description: "Reseteos instantáneos disponibles en la cuenta",
    category: "Desglose de Telemetría",
    disabled: false,
    onSelect: () => {},
  });

  // System diagnostics: sync latency
  const secondsAgo = Math.max(0, Math.round((now - telemetry.lastUpdated) / 1000));
  options.push({
    title: `Última sincronización: Hace ${secondsAgo}s`,
    value: "diag_sync",
    description: "Caché TTL 60s · Endpoint /wham/usage",
    category: "Diagnóstico del Sistema",
    disabled: false,
    onSelect: () => {},
  });

  // System diagnostics: account
  options.push({
    title: `Cuenta ChatGPT: Plan ${plan}`,
    value: "diag_account",
    description: "Conexión OAuth activa y autorizada",
    category: "Diagnóstico del Sistema",
    disabled: false,
    onSelect: () => {},
  });

  // Refresh action
  if (ctx.onRefresh) {
    options.push({
      title: "🔄 Forzar actualización de telemetría",
      value: "refresh",
      description: "Bypassea el caché de 60s y consulta a ChatGPT",
      category: "Acciones",
      disabled: false,
      onSelect: ctx.onRefresh,
    });
  }

  // Close option
  options.push({
    title: "✕ Cerrar",
    value: "close",
    category: "Acciones",
    disabled: false,
    onSelect: ctx.onClose,
  });

  return options;
}

/**
 * Backward compatibility alias for existing callers/tests.
 */
export const buildQuotaDialogOptions = buildQuotaCardOptions;
export type BuildOptionsContext = BuildQuotaOptionsContext;
