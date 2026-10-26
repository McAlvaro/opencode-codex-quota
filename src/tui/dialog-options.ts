import type { TuiDialogSelectOption } from "@opencode-ai/plugin/tui";
import type { QuotaTelemetry } from "../domain/models.js";
import {
  formatPlanType,
  calculatePacing,
  formatTimeRemaining,
  formatProgressBar,
  type PacingStatus,
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
 * Info rows use noop onSelect so they appear in the list but do nothing.
 * Action rows have real handlers. All text is plain Unicode (no ANSI codes).
 */
export function buildQuotaCardOptions(
  telemetry: QuotaTelemetry,
  ctx: BuildQuotaOptionsContext,
): TuiDialogSelectOption<string>[] {
  const now = ctx.nowMs ?? Date.now();
  const options: TuiDialogSelectOption<string>[] = [];

  const plan = formatPlanType(telemetry.planType);
  const pacing: PacingStatus = telemetry.primaryWindow
    ? calculatePacing(
        telemetry.primaryWindow.usedPercent,
        telemetry.primaryWindow.resetsAt,
        5 * 3600 * 1000,
        now,
      )
    : { text: "Al ritmo previsto", color: "green" };

  const credits = telemetry.availableResetCredits;

  // ── [Plan & Ritmo] ──────────────────────────────────────
  // "Codex Plus  ·  Al ritmo previsto"
  options.push({
    title: `${plan}  ·  ${pacing.text}`,
    value: "info_plan",
    category: "Plan & Ritmo",
    onSelect: () => {},
  });

  // ── [Límites de Cuota] ───────────────────────────────────
  // "5h  ━━━━━━────────  46%   Resetea en 2h 35m  ·  Libre: 54%"
  if (telemetry.primaryWindow) {
    const pw = telemetry.primaryWindow;
    const bar = formatProgressBar(pw.usedPercent, 14);
    const timeRemaining = formatTimeRemaining(pw.resetsAt, now);
    const pct = String(Math.round(pw.usedPercent)).padStart(3);
    const free = Math.round(pw.remainingPercent);
    options.push({
      title: `5h  ${bar.full}  ${pct}%   Resetea en ${timeRemaining}  ·  Libre: ${free}%`,
      value: "info_5h",
      category: "Límites de Cuota",
      onSelect: () => {},
    });
  }

  // "7d  ━─────────────   7%   Resetea en 6d 10h  ·  Libre: 93%  ·  ⚡ 0"
  if (telemetry.weeklyWindow) {
    const ww = telemetry.weeklyWindow;
    const bar = formatProgressBar(ww.usedPercent, 14);
    const timeRemaining = formatTimeRemaining(ww.resetsAt, now);
    const pct = String(Math.round(ww.usedPercent)).padStart(3);
    const free = Math.round(ww.remainingPercent);
    const creditSuffix = `  ·  ⚡ ${credits} ${credits === 1 ? "crédito" : "créditos"}`;
    options.push({
      title: `7d  ${bar.full}  ${pct}%   Resetea en ${timeRemaining}  ·  Libre: ${free}%${creditSuffix}`,
      value: "info_7d",
      category: "Límites de Cuota",
      onSelect: () => {},
    });
  }

  // ── [Acciones] ───────────────────────────────────────────
  options.push({
    title: "⚡  Canjear 1 Crédito de Reseteo",
    value: "consume",
    description:
      credits > 0
        ? `${credits} crédito(s) disponibles — reinicia la ventana de 5h a 0%`
        : "Sin créditos de reseteo disponibles en esta cuenta",
    category: "Acciones",
    onSelect: ctx.onConsume,
  });

  if (ctx.onRefresh) {
    options.push({
      title: "🔄  Sincronizar cuota ahora",
      value: "refresh",
      description: "Actualizar límites y métricas con ChatGPT",
      category: "Acciones",
      onSelect: ctx.onRefresh,
    });
  }

  options.push({
    title: "✕  Cerrar",
    value: "close",
    description: "Cerrar esta ventana",
    category: "Acciones",
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
  const pacing: PacingStatus = telemetry.primaryWindow
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
