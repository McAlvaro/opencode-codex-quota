import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isProviderOpenAI,
  isModelOpenAI,
  resolveActiveModel,
  isOpenAIActive,
  getOrCreateActiveModelSignal,
  createIsOpenAISignal,
  resetActiveModelSignal,
} from "./model-filter.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import fs from "node:fs";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe("model-filter", () => {
  describe("isProviderOpenAI", () => {
    it("should return true for openai provider (case-insensitive)", () => {
      expect(isProviderOpenAI("openai")).toBe(true);
      expect(isProviderOpenAI("OpenAI")).toBe(true);
      expect(isProviderOpenAI(" OPENAI ")).toBe(true);
    });

    it("should return false for other providers or undefined", () => {
      expect(isProviderOpenAI("anthropic")).toBe(false);
      expect(isProviderOpenAI("google")).toBe(false);
      expect(isProviderOpenAI("openrouter")).toBe(false);
      expect(isProviderOpenAI("github-copilot")).toBe(false);
      expect(isProviderOpenAI("ollama")).toBe(false);
      expect(isProviderOpenAI(undefined)).toBe(false);
      expect(isProviderOpenAI("")).toBe(false);
    });
  });

  describe("isModelOpenAI", () => {
    it("should return true when providerID is openai", () => {
      expect(
        isModelOpenAI({ providerID: "openai", modelID: "gpt-5.6-terra" }),
      ).toBe(true);
      expect(
        isModelOpenAI({ providerID: "openai", modelID: "custom-model" }),
      ).toBe(true);
    });

    it("should return false when providerID is non-openai even if model has gpt in name", () => {
      expect(
        isModelOpenAI({ providerID: "github-copilot", modelID: "gpt-4.1" }),
      ).toBe(false);
      expect(
        isModelOpenAI({
          providerID: "openrouter",
          modelID: "openai/gpt-4o",
        }),
      ).toBe(false);
    });

    it("should recognize openai/ prefix when no providerID is present", () => {
      expect(isModelOpenAI({ modelID: "openai/gpt-5" })).toBe(true);
      expect(isModelOpenAI({ modelID: "anthropic/claude" })).toBe(false);
      expect(isModelOpenAI({ modelID: "google/gemini" })).toBe(false);
    });

    it("should recognize standalone gpt/codex/o1 models", () => {
      expect(isModelOpenAI({ modelID: "gpt-5.6-terra" })).toBe(true);
      expect(isModelOpenAI({ modelID: "codex-5.2" })).toBe(true);
      expect(isModelOpenAI({ modelID: "o1-preview" })).toBe(true);
      expect(isModelOpenAI({ modelID: "o3-mini" })).toBe(true);
      expect(isModelOpenAI({ modelID: "claude-3-7-sonnet" })).toBe(false);
      expect(isModelOpenAI({ modelID: "gemini-2.5-flash" })).toBe(false);
    });

    it("should return false for null or empty candidates", () => {
      expect(isModelOpenAI(null)).toBe(false);
      expect(isModelOpenAI(undefined)).toBe(false);
      expect(isModelOpenAI({})).toBe(false);
    });
  });

  describe("resolveActiveModel & isOpenAIActive", () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should resolve model from session if sessionID exists and has model", () => {
      const mockApi = {
        state: {
          session: {
            get: vi.fn().mockReturnValue({
              id: "session-123",
              model: {
                id: "gpt-5.6-terra",
                providerID: "openai",
              },
            }),
          },
        },
      } as unknown as TuiPluginApi;

      const model = resolveActiveModel(mockApi, "session-123");
      expect(model).toEqual({
        providerID: "openai",
        modelID: "gpt-5.6-terra",
      });
      expect(isOpenAIActive(mockApi, "session-123")).toBe(true);
    });

    it("should return false when session model provider is not openai", () => {
      const mockApi = {
        state: {
          session: {
            get: vi.fn().mockReturnValue({
              id: "session-123",
              model: {
                id: "claude-3-5-sonnet",
                providerID: "anthropic",
              },
            }),
          },
        },
      } as unknown as TuiPluginApi;

      expect(isOpenAIActive(mockApi, "session-123")).toBe(false);
    });

    it("should resolve model from model.json when session has no model", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          recent: [{ providerID: "openai", modelID: "gpt-5.6-terra" }],
        }),
      );

      const mockApi = {
        state: {
          path: { state: "/mock/state" },
        },
      } as unknown as TuiPluginApi;

      const model = resolveActiveModel(mockApi);
      expect(model).toEqual({
        providerID: "openai",
        modelID: "gpt-5.6-terra",
      });
      expect(isOpenAIActive(mockApi)).toBe(true);
    });

    it("should resolve false when model.json recent model is not openai", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          recent: [{ providerID: "google", modelID: "gemini-3.8-flash" }],
        }),
      );

      const mockApi = {
        state: {
          path: { state: "/mock/state" },
        },
      } as unknown as TuiPluginApi;

      expect(isOpenAIActive(mockApi)).toBe(false);
    });

    it("should fallback to config.model when model.json does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const mockApi = {
        state: {
          path: { state: "/mock/state" },
          config: {
            model: "openai/gpt-4o",
          },
        },
      } as unknown as TuiPluginApi;

      expect(isOpenAIActive(mockApi)).toBe(true);
    });
  });

  describe("reactive model signal & watcher", () => {
    it("should update reactive signal when initModelWatcher checks", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          recent: [{ providerID: "google", modelID: "gemini-3-flash-preview" }],
        }),
      );

      const mockApi = {
        state: {
          path: { state: "/mock/state" },
        },
      } as unknown as TuiPluginApi;

      const { model, setModel } = getOrCreateActiveModelSignal(mockApi);
      expect(isModelOpenAI(model())).toBe(false);

      // Simulate model change to openai
      setModel({ providerID: "openai", modelID: "gpt-5.6-terra" });
      expect(isModelOpenAI(model())).toBe(true);
    });
  });
});
