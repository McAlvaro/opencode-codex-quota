import { describe, it, expect } from "vitest";
import {
  formatTimeRemaining,
  getQuotaSeverity,
  formatBadge,
  formatProgressBar,
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
      const res = formatProgressBar(0, 24);
      expect(res.filled).toBe("");
      expect(res.empty).toBe("─".repeat(24));
      expect(res.full).toBe("─".repeat(24));
    });

    it("should format full bar for 100% usage", () => {
      const res = formatProgressBar(100, 24);
      expect(res.filled).toBe("━".repeat(24));
      expect(res.empty).toBe("");
      expect(res.full).toBe("━".repeat(24));
    });

    it("should format proportional blocks for partial usage (50%)", () => {
      const res = formatProgressBar(50, 24);
      expect(res.filled).toBe("━".repeat(12));
      expect(res.empty).toBe("─".repeat(12));
      expect(res.full).toBe("━".repeat(12) + "─".repeat(12));
    });

    it("should clamp values below 0 and above 100", () => {
      const below = formatProgressBar(-10, 24);
      expect(below.filled).toBe("");
      expect(below.empty).toBe("─".repeat(24));

      const above = formatProgressBar(150, 24);
      expect(above.filled).toBe("━".repeat(24));
      expect(above.empty).toBe("");
    });

    it("should handle non-finite numbers safely", () => {
      const nanRes = formatProgressBar(NaN, 24);
      expect(nanRes.filled).toBe("");
      expect(nanRes.empty).toBe("─".repeat(24));
    });
  });

  describe("formatBadge", () => {
    const NOW = 1_700_000_000_000;

    it("should return No Auth badge when auth file is missing", () => {
      const badge = formatBadge(null, "missing-file", NOW);
      expect(badge).toEqual({
        text: "Codex · No Auth",
        color: "gray",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · No Auth",
      });
    });

    it("should return Off badge when openai key is missing", () => {
      const badge = formatBadge(null, "missing-openai", NOW);
      expect(badge).toEqual({
        text: "Codex · Off",
        color: "gray",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · Off",
      });
    });

    it("should return Expired badge with red color when token is expired", () => {
      const badge = formatBadge(null, "expired", NOW);
      expect(badge).toEqual({
        text: "Codex · Expired",
        color: "red",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · Expired",
      });
    });

    it("should return Invalid badge when schema is invalid", () => {
      const badge = formatBadge(null, "invalid-schema", NOW);
      expect(badge).toEqual({
        text: "Codex · Invalid",
        color: "red",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · Invalid",
      });
    });

    it("should return placeholder when telemetry is null but auth is valid", () => {
      const badge = formatBadge(null, "valid", NOW);
      expect(badge).toEqual({
        text: "Codex · ...",
        color: "gray",
        barText: "",
        filledBar: "",
        emptyBar: "",
        prefixText: "Codex",
        metaText: " · ...",
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
      const bar = formatProgressBar(0, 24);
      expect(badge).toEqual({
        text: "Codex · Active · ⚡ 3",
        color: "green",
        barText: bar.full,
        filledBar: bar.filled,
        emptyBar: bar.empty,
        prefixText: "Codex",
        metaText: " · Active · ⚡ 3",
      });
    });

    it("should format active quota with primary window and available credits", () => {
      const telemetry: QuotaTelemetry = {
        primaryWindow: {
          name: "5-hour",
          usedPercent: 42.4,
          remainingPercent: 57.6,
          resetsAt: NOW + (2 * 3600 + 15 * 60) * 1000,
        },
        weeklyWindow: null,
        availableResetCredits: 1,
        lastUpdated: NOW,
      };

      const badge = formatBadge(telemetry, "valid", NOW);
      const bar = formatProgressBar(42.4, 24);
      expect(badge).toEqual({
        text: "Codex 42% · ⏳ 2h 15m · ⚡ 1",
        color: "green",
        barText: bar.full,
        filledBar: bar.filled,
        emptyBar: bar.empty,
        prefixText: "Codex 42%",
        metaText: " · ⏳ 2h 15m · ⚡ 1",
      });
    });

    it("should apply yellow color when quota is in warning range (e.g. 75%)", () => {
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
      const bar = formatProgressBar(75, 24);
      expect(badge).toEqual({
        text: "Codex 75% · ⏳ 30m · ⚡ 0",
        color: "yellow",
        barText: bar.full,
        filledBar: bar.filled,
        emptyBar: bar.empty,
        prefixText: "Codex 75%",
        metaText: " · ⏳ 30m · ⚡ 0",
      });
    });

    it("should apply red color when quota is in critical range (e.g. 90%)", () => {
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
      const bar = formatProgressBar(90, 24);
      expect(badge).toEqual({
        text: "Codex 90% · ⏳ 10m · ⚡ 2",
        color: "red",
        barText: bar.full,
        filledBar: bar.filled,
        emptyBar: bar.empty,
        prefixText: "Codex 90%",
        metaText: " · ⏳ 10m · ⚡ 2",
      });
    });
  });
});
