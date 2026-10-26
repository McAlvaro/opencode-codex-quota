import { describe, it, expect, vi } from "vitest";
import {
  buildQuotaCardOptions,
  buildUsageCardOptions,
} from "./dialog-options.js";
import type { QuotaTelemetry } from "../domain/models.js";

const NOW = 1_700_000_000_000;

describe("buildQuotaCardOptions", () => {
  it("should build options tailored for quota limits and reset actions", () => {
    const telemetry: QuotaTelemetry = {
      primaryWindow: {
        name: "5-hour",
        usedPercent: 42.5,
        remainingPercent: 57.5,
        resetsAt: NOW + (2 * 3600 + 15 * 60) * 1000,
      },
      weeklyWindow: {
        name: "weekly",
        usedPercent: 28,
        remainingPercent: 72,
        resetsAt: NOW + 48 * 3600 * 1000,
      },
      availableResetCredits: 1,
      lastUpdated: NOW,
      planType: "plus",
    };

    const onConsume = vi.fn();
    const onRefresh = vi.fn();
    const onClose = vi.fn();

    const options = buildQuotaCardOptions(telemetry, {
      nowMs: NOW,
      onConsume,
      onRefresh,
      onClose,
    });

    expect(options.length).toBe(6);

    // Option 0: Plan & Pacing
    expect(options[0].title).toContain("Plan Plus");
    expect(options[0].title).toContain("Al ritmo previsto");
    expect(options[0].category).toBe("Plan & Ritmo");
    expect(options[0].disabled).toBe(false);

    // Option 1: 5-Hour Window
    expect(options[1].title).toContain("5h: 43%");
    expect(options[1].description).toContain("2h 15m");
    expect(options[1].category).toBe("Límites de Cuota");
    expect(options[1].disabled).toBe(false);

    // Option 2: Weekly Window
    expect(options[2].title).toContain("7d: 28%");
    expect(options[2].description).toContain("2d 0h");
    expect(options[2].category).toBe("Límites de Cuota");
    expect(options[2].disabled).toBe(false);

    // Option 3: Consume credit
    expect(options[3].title).toBe("⚡ Canjear 1 Crédito de Reseteo");
    expect(options[3].description).toContain("1 crédito(s) disponibles");
    expect(options[3].disabled).toBe(false);
    options[3].onSelect?.();
    expect(onConsume).toHaveBeenCalledTimes(1);

    // Option 4: Refresh
    expect(options[4].title).toContain("Sincronizar cuota ahora");
    options[4].onSelect?.();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Option 5: Close
    expect(options[5].title).toContain("Cerrar");
    options[5].onSelect?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("buildUsageCardOptions", () => {
  it("should build options tailored for analytical usage metrics and diagnostics", () => {
    const telemetry: QuotaTelemetry = {
      primaryWindow: {
        name: "5-hour",
        usedPercent: 19.4,
        remainingPercent: 80.6,
        resetsAt: NOW + (4 * 3600 + 10 * 60) * 1000,
      },
      weeklyWindow: {
        name: "weekly",
        usedPercent: 3.2,
        remainingPercent: 96.8,
        resetsAt: NOW + 7 * 24 * 3600 * 1000,
      },
      availableResetCredits: 0,
      lastUpdated: NOW - 12_000,
      planType: "plus",
    };

    const onRefresh = vi.fn();
    const onClose = vi.fn();

    const options = buildUsageCardOptions(telemetry, {
      nowMs: NOW,
      onRefresh,
      onClose,
    });

    expect(options.length).toBe(8);

    // Pacing Analysis
    expect(options[0].title).toBe("Velocidad: Al ritmo previsto");
    expect(options[0].description).toContain("19.4% consumido");
    expect(options[0].category).toBe("Análisis de Consumo");

    // Detailed 5h Window
    expect(options[1].title).toBe("Ventana 5 Horas: 19.4%");
    expect(options[1].description).toContain("Libre: 80.6%");
    expect(options[1].category).toBe("Desglose de Telemetría");

    // Detailed 7d Window
    expect(options[2].title).toBe("Ventana 7 Días: 3.2%");
    expect(options[2].description).toContain("Libre: 96.8%");
    expect(options[2].category).toBe("Desglose de Telemetría");

    // Credits Pool
    expect(options[3].title).toBe("Créditos de Emergencia: 0");
    expect(options[3].category).toBe("Desglose de Telemetría");

    // Diagnostics: Sync
    expect(options[4].title).toBe("Última sincronización: Hace 12s");
    expect(options[4].description).toContain("Caché TTL 60s");
    expect(options[4].category).toBe("Diagnóstico del Sistema");

    // Diagnostics: Account
    expect(options[5].title).toBe("Cuenta ChatGPT: Plan Plus");
    expect(options[5].category).toBe("Diagnóstico del Sistema");

    // Refresh action
    expect(options[6].title).toContain("Forzar actualización de telemetría");
    options[6].onSelect?.();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Close
    expect(options[7].title).toContain("Cerrar");
    options[7].onSelect?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
