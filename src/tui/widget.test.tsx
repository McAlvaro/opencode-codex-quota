import { describe, it, expect, vi } from "vitest";
import { isWidgetVisible } from "./widget.js";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";

describe("isWidgetVisible", () => {
  const mockAuthProvider = {} as OpenCodeAuthProvider;
  const mockTelemetryClient = {} as CodexTelemetryClient;

  it("should return false when isOpenAI is explicitly false", () => {
    const visible = isWidgetVisible({
      authProvider: mockAuthProvider,
      telemetryClient: mockTelemetryClient,
      isOpenAI: false,
    });
    expect(visible).toBe(false);
  });

  it("should return true when isOpenAI is explicitly true", () => {
    const visible = isWidgetVisible({
      authProvider: mockAuthProvider,
      telemetryClient: mockTelemetryClient,
      isOpenAI: true,
    });
    expect(visible).toBe(true);
  });

  it("should evaluate isOpenAI function if provided", () => {
    const visibleFn = isWidgetVisible({
      authProvider: mockAuthProvider,
      telemetryClient: mockTelemetryClient,
      isOpenAI: () => true,
    });
    expect(visibleFn).toBe(true);

    const hiddenFn = isWidgetVisible({
      authProvider: mockAuthProvider,
      telemetryClient: mockTelemetryClient,
      isOpenAI: () => false,
    });
    expect(hiddenFn).toBe(false);
  });

  it("should query isOpenAIActive with api and sessionID when isOpenAI prop is omitted", () => {
    const mockApi = {
      state: {
        session: {
          get: vi.fn().mockReturnValue({
            id: "s1",
            model: { providerID: "openai", id: "gpt-5" },
          }),
        },
      },
    } as unknown as TuiPluginApi;

    const visible = isWidgetVisible({
      authProvider: mockAuthProvider,
      telemetryClient: mockTelemetryClient,
      api: mockApi,
      sessionID: "s1",
    });
    expect(visible).toBe(true);

    const mockApiNonOpenAI = {
      state: {
        session: {
          get: vi.fn().mockReturnValue({
            id: "s2",
            model: { providerID: "anthropic", id: "claude-3-7-sonnet" },
          }),
        },
      },
    } as unknown as TuiPluginApi;

    const hidden = isWidgetVisible({
      authProvider: mockAuthProvider,
      telemetryClient: mockTelemetryClient,
      api: mockApiNonOpenAI,
      sessionID: "s2",
    });
    expect(hidden).toBe(false);
  });
});
