import { describe, it, expect, vi } from "vitest";
import { registerQuotaSlots } from "./slot.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";

vi.mock("./widget.js", () => ({
  CodexQuotaWidget: vi.fn((props) => ({ type: "CodexQuotaWidget", props })),
}));

describe("registerQuotaSlots", () => {
  const mockAuthProvider = {} as OpenCodeAuthProvider;
  const mockTelemetryClient = {} as CodexTelemetryClient;

  it("should register sidebar_footer slot by default to avoid duplicate rendering", () => {
    let capturedPlugin: any = null;

    const mockApi = {
      slots: {
        register: vi.fn().mockImplementation((plugin) => {
          capturedPlugin = plugin;
          return "quota-slot-reg-id";
        }),
      },
    } as unknown as TuiPluginApi;

    const regId = registerQuotaSlots(mockApi, mockAuthProvider, mockTelemetryClient, {
      pollIntervalMs: 15_000,
    });

    expect(regId).toBe("quota-slot-reg-id");
    expect(mockApi.slots.register).toHaveBeenCalledTimes(1);
    expect(capturedPlugin).toBeDefined();
    expect(typeof capturedPlugin.slots.sidebar_footer).toBe("function");
    expect(capturedPlugin.slots.session_prompt_right).toBeUndefined();

    const footerElement = capturedPlugin.slots.sidebar_footer({
      session_id: "test-sess",
    });
    expect(footerElement).toEqual({
      type: "CodexQuotaWidget",
      props: {
        api: mockApi,
        sessionID: "test-sess",
        authProvider: mockAuthProvider,
        telemetryClient: mockTelemetryClient,
        pollIntervalMs: 15_000,
      },
    });
  });

  it("should register both slots when slot option is 'both'", () => {
    let capturedPlugin: any = null;

    const mockApi = {
      slots: {
        register: vi.fn().mockImplementation((plugin) => {
          capturedPlugin = plugin;
          return "quota-slot-reg-id";
        }),
      },
    } as unknown as TuiPluginApi;

    registerQuotaSlots(mockApi, mockAuthProvider, mockTelemetryClient, {
      slot: "both",
    });

    expect(typeof capturedPlugin.slots.sidebar_footer).toBe("function");
    expect(typeof capturedPlugin.slots.session_prompt_right).toBe("function");
  });

  it("should register only session_prompt_right when specified", () => {
    let capturedPlugin: any = null;

    const mockApi = {
      slots: {
        register: vi.fn().mockImplementation((plugin) => {
          capturedPlugin = plugin;
          return "quota-slot-reg-id";
        }),
      },
    } as unknown as TuiPluginApi;

    registerQuotaSlots(mockApi, mockAuthProvider, mockTelemetryClient, {
      slot: "session_prompt_right",
    });

    expect(capturedPlugin.slots.sidebar_footer).toBeUndefined();
    expect(typeof capturedPlugin.slots.session_prompt_right).toBe("function");
  });
});
