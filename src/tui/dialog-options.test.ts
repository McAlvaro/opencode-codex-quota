import { describe, it, expect, vi } from "vitest";
import { buildQuotaDialogOptions } from "./dialog-options.js";
import type { QuotaTelemetry } from "../domain/models.js";

const NOW = 1_700_000_000_000;

describe("buildQuotaDialogOptions", () => {
  it("should build options with 5h window, weekly window, and active reset credit", () => {
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
    };

    const onConsume = vi.fn();
    const onClose = vi.fn();

    const options = buildQuotaDialogOptions(telemetry, {
      nowMs: NOW,
      onConsume,
      onClose,
    });

    expect(options.length).toBe(4);

    // Option 1: 5-Hour Window
    expect(options[0].title).toBe("5-Hour Window: 42.5% used");
    expect(options[0].description).toContain("2h 15m");
    expect(options[0].disabled).toBe(true);

    // Option 2: Weekly Window
    expect(options[1].title).toBe("Weekly Limit: 28.0% used");
    expect(options[1].description).toContain("2d 0h");
    expect(options[1].disabled).toBe(true);

    // Option 3: Consume credit (enabled since credits = 1)
    expect(options[2].title).toBe("⚡ Redeem 1 Reset Credit");
    expect(options[2].description).toBe("1 credit available");
    expect(options[2].disabled).toBe(false);
    options[2].onSelect?.();
    expect(onConsume).toHaveBeenCalledTimes(1);

    // Option 4: Close
    expect(options[3].title).toBe("Close");
    options[3].onSelect?.();
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
    expect(consumeOption?.description).toBe("No reset credits available");
  });
});
