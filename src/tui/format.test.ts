import { describe, it, expect } from "vitest";
import {
  formatTimeRemaining,
  getQuotaSeverity,
  formatBadge,
  formatProgressBar,
  formatWindowData,
  calculatePacing,
  formatPlanType,
  colorize,
  formatColoredProgressBar,
} from "./format.js";
import type { QuotaTelemetry } from "../domain/models.js";

describe("TUI formatting helpers", () => {
  describe("formatTimeRemaining", () => {
    it("should return 0m when time has passed or is exact", () => {
      expect(formatTimeRemaining(1000, 1000)).toBe("0m");
      expect(formatTimeRemaining(500, 1000)).toBe("0m");
    });

    it("should format minutes correctly when under 1 hour", () => {
      const now = 1_000_000;
      const resetsAt = now + 45 * 60 * 1000; // +45m
      expect(formatTimeRemaining(resetsAt, now)).toBe("45m");
    });

    it("should format hours and minutes when over 1 hour", () => {
      const now = 1_000_000;
      const resetsAt = now + (2 * 3600 + 15 * 60) * 1000; // 2h 15m
      expect(formatTimeRemaining(resetsAt, now)).toBe("2h 15m");
    });

    it("should format days and hours when over 24 hours", () => {
      const now = 1_000_000;
      const resetsAt = now + (26 * 3600) * 1000; // 1d 2h
      expect(formatTimeRemaining(resetsAt, now)).toBe("1d 2h");
    });
  });

  describe("getQuotaSeverity", () => {
    it("should return green for usage below 70%", () => {
      expect(getQuotaSeverity(0)).toBe("green");
      expect(getQuotaSeverity(42)).toBe("green");
      expect(getQuotaSeverity(69.9)).toBe("green");
    });

    it("should return yellow for usage between 70% and 85%", () => {
      expect(getQuotaSeverity(70)).toBe("yellow");
      expect(getQuotaSeverity(80)).toBe("yellow");
      expect(getQuotaSeverity(84.9)).toBe("yellow");
    });

    it("should return red for usage at or above 85%", () => {
      expect(getQuotaSeverity(85)).toBe("red");
      expect(getQuotaSeverity(95)).toBe("red");
      expect(getQuotaSeverity(100)).toBe("red");
    });
  });

  describe("formatProgressBar", () => {
    it("should format empty bar for 0% usage", () => {
      const res = formatProgressBar(0, 10);
      expect(res.filled).toBe("");
      expect(res.empty).toBe("─".repeat(10));
      expect(res.full).toBe("─".repeat(10));
    });

    it("should format full bar for 100% usage", () => {
      const res = formatProgressBar(100, 10);
      expect(res.filled).toBe("━".repeat(10));
      expect(res.empty).toBe("");
      expect(res.full).toBe("━".repeat(10));
    });

    it("should format proportional blocks for partial usage (50%)", () => {
      const res = formatProgressBar(50, 10);
      expect(res.filled).toBe("━".repeat(5));
      expect(res.empty).toBe("─".repeat(5));
      expect(res.full).toBe("━".repeat(5) + "─".repeat(5));
    });

    it("should clamp values below 0 and above 100", () => {
      const below = formatProgressBar(-10, 10);
      expect(below.filled).toBe("");
      expect(below.empty).toBe("─".repeat(10));

      const above = formatProgressBar(150, 10);
      expect(above.filled).toBe("━".repeat(10));
      expect(above.empty).toBe("");
    });

    it("should handle non-finite numbers safely", () => {
      const nanRes = formatProgressBar(NaN, 10);
      expect(nanRes.filled).toBe("");
      expect(nanRes.empty).toBe("─".repeat(10));
    });
  });

  describe("formatWindowData", () => {
    it("should return undefined when window is null", () => {
      expect(formatWindowData(null, "5h", 1000)).toBeUndefined();
    });

    it("should format window data correctly", () => {
      const res = formatWindowData(
        {
          name: "5h Rolling",
          usedPercent: 42.4,
          remainingPercent: 57.6,
          resetsAt: 1000 + 3600 * 1000,
        },
        "5h",
        1000,
        10,
      );
      expect(res).toBeDefined();
      expect(res?.label).toBe("5h");
      expect(res?.usedPercent).toBe(42);
      expect(res?.color).toBe("green");
      expect(res?.timeRemaining).toBe("1h 0m");
      expect(res?.filledBar).toBe("━".repeat(4));
      expect(res?.emptyBar).toBe("─".repeat(6));
    });
  });

  describe("formatBadge", () => {
    const NOW = 1_700_000_000_000;

    it("should return No Auth badge when auth file is missing", () => {
      const badge = formatBadge(null, "missing-file", NOW);
      expect(badge).toEqual({
        text: "Codex · No Auth",
        color: "gray",
        credits: 0,
        prefixText: "Codex",
        metaText: " · No Auth",
        plan: "Codex",
        pacing: {
          text: "No Auth",
          color: "gray",
        },
      });
    });

    it("should return Off badge when openai key is missing", () => {
      const badge = formatBadge(null, "missing-openai", NOW);
      expect(badge).toEqual({
        text: "Codex · Off",
        color: "gray",
        credits: 0,
        prefixText: "Codex",
        metaText: " · Off",
        plan: "Codex",
        pacing: {
          text: "Off",
          color: "gray",
        },
      });
    });

    it("should return Expired badge with red color when token is expired", () => {
      const badge = formatBadge(null, "expired", NOW);
      expect(badge).toEqual({
        text: "Codex · Expired",
        color: "red",
        credits: 0,
        prefixText: "Codex",
        metaText: " · Expired",
        plan: "Codex",
        pacing: {
          text: "Expired",
          color: "red",
        },
      });
    });

    it("should return Invalid badge when schema is invalid", () => {
      const badge = formatBadge(null, "invalid-schema", NOW);
      expect(badge).toEqual({
        text: "Codex · Invalid",
        color: "red",
        credits: 0,
        prefixText: "Codex",
        metaText: " · Invalid",
        plan: "Codex",
        pacing: {
          text: "Invalid",
          color: "red",
        },
      });
    });

    it("should return placeholder when telemetry is null but auth is valid", () => {
      const badge = formatBadge(null, "valid", NOW);
      expect(badge).toEqual({
        text: "Codex · ...",
        color: "gray",
        credits: 0,
        prefixText: "Codex",
        metaText: " · ...",
        plan: "Codex",
        pacing: {
          text: "...",
          color: "gray",
        },
      });
    });

    it("should format active status when primaryWindow is null", () => {
      const telemetry: QuotaTelemetry = {
        primaryWindow: null,
        weeklyWindow: null,
        availableResetCredits: 3,
        lastUpdated: NOW,
      };

      const badge = formatBadge(telemetry, "valid", NOW);
      expect(badge.text).toBe("Codex · Active · ⚡ 3");
      expect(badge.color).toBe("green");
      expect(badge.credits).toBe(3);
    });

    it("should format active quota with primary and weekly windows", () => {
      const telemetry: QuotaTelemetry = {
        primaryWindow: {
          name: "5-hour",
          usedPercent: 42.4,
          remainingPercent: 57.6,
          resetsAt: NOW + (2 * 3600 + 15 * 60) * 1000,
        },
        weeklyWindow: {
          name: "Weekly",
          usedPercent: 12.0,
          remainingPercent: 88.0,
          resetsAt: NOW + (6 * 24 * 3600 + 21 * 3600) * 1000,
        },
        availableResetCredits: 1,
        lastUpdated: NOW,
      };

      const badge = formatBadge(telemetry, "valid", NOW);
      expect(badge.color).toBe("green");
      expect(badge.credits).toBe(1);
      expect(badge.primary).toBeDefined();
      expect(badge.primary?.label).toBe("5h");
      expect(badge.primary?.usedPercent).toBe(42);
      expect(badge.primary?.timeRemaining).toBe("2h 15m");

      expect(badge.weekly).toBeDefined();
      expect(badge.weekly?.label).toBe("7d");
      expect(badge.weekly?.usedPercent).toBe(12);
      expect(badge.weekly?.timeRemaining).toBe("6d 21h");
    });

    it("should apply yellow color when primary quota is in warning range (75%)", () => {
      const telemetry: QuotaTelemetry = {
        primaryWindow: {
          name: "5-hour",
          usedPercent: 75,
          remainingPercent: 25,
          resetsAt: NOW + 30 * 60 * 1000,
        },
        weeklyWindow: null,
        availableResetCredits: 0,
        lastUpdated: NOW,
      };

      const badge = formatBadge(telemetry, "valid", NOW);
      expect(badge.color).toBe("yellow");
      expect(badge.primary?.color).toBe("yellow");
    });

    it("should apply red color when primary quota is in critical range (90%)", () => {
      const telemetry: QuotaTelemetry = {
        primaryWindow: {
          name: "5-hour",
          usedPercent: 90,
          remainingPercent: 10,
          resetsAt: NOW + 10 * 60 * 1000,
        },
        weeklyWindow: null,
        availableResetCredits: 2,
        lastUpdated: NOW,
      };

      const badge = formatBadge(telemetry, "valid", NOW);
      expect(badge.color).toBe("red");
      expect(badge.primary?.color).toBe("red");
    });
  });

  describe("formatPlanType", () => {
    it("should format known plans correctly with Codex prefix", () => {
      expect(formatPlanType("plus")).toBe("Codex Plus");
      expect(formatPlanType("pro")).toBe("Codex Pro");
      expect(formatPlanType("team")).toBe("Codex Team");
      expect(formatPlanType("enterprise")).toBe("Codex Enterprise");
    });

    it("should default to Codex Plus when plan is unknown or missing", () => {
      expect(formatPlanType(undefined)).toBe("Codex Plus");
      expect(formatPlanType("")).toBe("Codex Plus");
      expect(formatPlanType("custom_plan")).toBe("Codex Custom_plan");
    });
  });

  describe("colorize and formatColoredProgressBar", () => {
    it("should wrap text with ANSI color codes and reset", () => {
      expect(colorize("test", "green")).toBe("\x1b[32mtest\x1b[39m");
      expect(colorize("test", "yellow")).toBe("\x1b[33mtest\x1b[39m");
      expect(colorize("test", "red")).toBe("\x1b[31mtest\x1b[39m");
      expect(colorize("test", "gray")).toBe("\x1b[90mtest\x1b[39m");
      expect(colorize("", "green")).toBe("");
    });

    it("should format colored progress bar with filled color and gray empty", () => {
      const colored = formatColoredProgressBar(30, 10, "green");
      expect(colored).toContain("\x1b[32m━━━\x1b[39m");
      expect(colored).toContain("\x1b[90m───────\x1b[39m");
    });
  });

  describe("calculatePacing", () => {
    const WINDOW_5H = 5 * 3600 * 1000;
    const NOW = 1_700_000_000_000;

    it("should report Al ritmo previsto when usage is 0%", () => {
      const pacing = calculatePacing(0, NOW + 2 * 3600 * 1000, WINDOW_5H, NOW);
      expect(pacing.text).toBe("Al ritmo previsto");
      expect(pacing.color).toBe("green");
    });

    it("should report En riesgo de límite when usage is >= 85%", () => {
      const pacing = calculatePacing(88, NOW + 4 * 3600 * 1000, WINDOW_5H, NOW);
      expect(pacing.text).toBe("En riesgo de límite");
      expect(pacing.color).toBe("red");
    });

    it("should report Consumo acelerado when consumption pace significantly exceeds elapsed time", () => {
      // 60% used after only 1 hour elapsed (4 hours remaining out of 5) => elapsed is 20%, pace is 60/20 = 3
      const pacing = calculatePacing(60, NOW + 4 * 3600 * 1000, WINDOW_5H, NOW);
      expect(pacing.text).toBe("Consumo acelerado");
      expect(pacing.color).toBe("yellow");
    });

    it("should report Al ritmo previsto when usage is normal", () => {
      // 30% used after 2 hours elapsed (3 hours remaining) => elapsed is 40%
      const pacing = calculatePacing(30, NOW + 3 * 3600 * 1000, WINDOW_5H, NOW);
      expect(pacing.text).toBe("Al ritmo previsto");
      expect(pacing.color).toBe("green");
    });
  });
});
