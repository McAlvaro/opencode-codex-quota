import { describe, it, expect, vi } from "vitest";
import { buildQuotaDialogOptions } from "./dialog-options.js";
import type { QuotaTelemetry } from "../domain/models.js";

const NOW = 1_700_000_000_000;

describe("buildQuotaDialogOptions", () => {
  it("should build options with plan status, 5h window, weekly window, and active reset credit", () => {
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
    const onClose = vi.fn();

    const options = buildQuotaDialogOptions(telemetry, {
      nowMs: NOW,
      onConsume,
      onClose,
    });

    expect(options.length).toBe(5);

    // Option 0: Plan & Pacing
    expect(options[0].title).toContain("Suscripción: Plus");
    expect(options[0].title).toContain("Al ritmo previsto");
    expect(options[0].disabled).toBe(true);

    // Option 1: 5-Hour Window
    expect(options[1].title).toContain("5h Window: 42.5%");
    expect(options[1].description).toContain("2h 15m");
    expect(options[1].disabled).toBe(true);

    // Option 2: Weekly Window
    expect(options[2].title).toContain("7d Window: 28.0%");
    expect(options[2].description).toContain("2d 0h");
    expect(options[2].disabled).toBe(true);

    // Option 3: Consume credit (enabled since credits = 1)
    expect(options[3].title).toBe("⚡ Canjear 1 Crédito de Reseteo");
    expect(options[3].description).toContain("1 crédito disponible");
    expect(options[3].disabled).toBe(false);
    options[3].onSelect?.();
    expect(onConsume).toHaveBeenCalledTimes(1);

    // Option 4: Close
    expect(options[4].title).toBe("Cerrar");
    options[4].onSelect?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should disable consume option when available credits is 0", () => {
    const telemetry: QuotaTelemetry = {
      primaryWindow: null,
      weeklyWindow: null,
      availableResetCredits: 0,
      lastUpdated: NOW,
    };

    const options = buildQuotaDialogOptions(telemetry, {
      nowMs: NOW,
      onConsume: vi.fn(),
      onClose: vi.fn(),
    });

    const consumeOption = options.find((opt) => opt.value === "consume");
    expect(consumeOption).toBeDefined();
    expect(consumeOption?.disabled).toBe(true);
    expect(consumeOption?.description).toContain("Sin créditos de reseteo disponibles");
  });
});
