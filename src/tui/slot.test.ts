import { describe, it, expect, vi } from "vitest";
import { registerQuotaSlots } from "./slot.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";

vi.mock("./widget.js", () => ({
  CodexQuotaWidget: vi.fn((props) => ({ type: "CodexQuotaWidget", props })),
}));

describe("registerQuotaSlots", () => {
  it("should register sidebar_footer and session_prompt_right slots on api.slots", () => {
    let capturedPlugin: any = null;

    const mockApi = {
      slots: {
        register: vi.fn().mockImplementation((plugin) => {
          capturedPlugin = plugin;
          return "quota-slot-reg-id";
        }),
      },
    } as unknown as TuiPluginApi;

    const mockAuthProvider = {} as OpenCodeAuthProvider;
    const mockTelemetryClient = {} as CodexTelemetryClient;

    const regId = registerQuotaSlots(mockApi, mockAuthProvider, mockTelemetryClient, {
      pollIntervalMs: 15_000,
    });

    expect(regId).toBe("quota-slot-reg-id");
    expect(mockApi.slots.register).toHaveBeenCalledTimes(1);
    expect(capturedPlugin).toBeDefined();
    expect(typeof capturedPlugin.slots.sidebar_footer).toBe("function");
    expect(typeof capturedPlugin.slots.session_prompt_right).toBe("function");

    // Invoking the slot renderers calls the component with expected props
    const footerElement = capturedPlugin.slots.sidebar_footer();
    expect(footerElement).toEqual({
      type: "CodexQuotaWidget",
      props: {
        authProvider: mockAuthProvider,
        telemetryClient: mockTelemetryClient,
        pollIntervalMs: 15_000,
      },
    });

    const promptElement = capturedPlugin.slots.session_prompt_right();
    expect(promptElement).toEqual({
      type: "CodexQuotaWidget",
      props: {
        authProvider: mockAuthProvider,
        telemetryClient: mockTelemetryClient,
        pollIntervalMs: 15_000,
      },
    });
  });
});
