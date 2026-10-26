import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  showQuotaDetailsDialog,
  showUsageDetailsDialog,
} from "./reset-dialog.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";
import type { ResetController } from "../actions/reset-controller.js";
import type { QuotaTelemetry, ValidCredentials } from "../domain/models.js";

const VALID_CREDS: ValidCredentials = {
  accessToken: "token-abc",
  accountId: "acct-1",
  expiresAt: 1_900_000_000_000,
};

const SAMPLE_TELEMETRY: QuotaTelemetry = {
  primaryWindow: {
    name: "5-hour",
    usedPercent: 50,
    remainingPercent: 50,
    resetsAt: 1_700_000_000_000 + 3600_000,
  },
  weeklyWindow: null,
  availableResetCredits: 1,
  lastUpdated: 1_700_000_000_000,
};

describe("showQuotaDetailsDialog", () => {
  let mockApi: any;
  let mockAuthProvider: any;
  let mockTelemetryClient: any;
  let mockResetController: any;

  beforeEach(() => {
    mockApi = {
      ui: {
        toast: vi.fn(),
        dialog: {
          replace: vi.fn(),
          clear: vi.fn(),
          setSize: vi.fn(),
        },
        DialogSelect: vi.fn((props) => ({ type: "DialogSelect", props })),
        DialogConfirm: vi.fn((props) => ({ type: "DialogConfirm", props })),
      },
    };

    mockAuthProvider = {
      getCredentials: vi.fn().mockResolvedValue({
        status: "valid",
        credentials: VALID_CREDS,
      }),
    };

    mockTelemetryClient = {
      getTelemetry: vi.fn().mockResolvedValue(SAMPLE_TELEMETRY),
      invalidateCache: vi.fn(),
    };

    mockResetController = {
      consume: vi.fn().mockResolvedValue({
        success: true,
        message: "Reset applied!",
      }),
    };
  });

  it("should show error toast and abort if credentials are not valid", async () => {
    mockAuthProvider.getCredentials.mockResolvedValue({ status: "expired" });

    await showQuotaDetailsDialog(
      mockApi as TuiPluginApi,
      mockAuthProvider as OpenCodeAuthProvider,
      mockTelemetryClient as CodexTelemetryClient,
      mockResetController as ResetController,
    );

    expect(mockApi.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        message: "Authentication issue: expired",
      }),
    );
    expect(mockTelemetryClient.getTelemetry).not.toHaveBeenCalled();
    expect(mockApi.ui.dialog.replace).not.toHaveBeenCalled();
  });

  it("should show error toast and abort if telemetry fetch fails", async () => {
    mockTelemetryClient.getTelemetry.mockResolvedValue(null);

    await showQuotaDetailsDialog(
      mockApi as TuiPluginApi,
      mockAuthProvider as OpenCodeAuthProvider,
      mockTelemetryClient as CodexTelemetryClient,
      mockResetController as ResetController,
    );

    expect(mockApi.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        message: "Failed to retrieve quota telemetry from ChatGPT backend",
      }),
    );
    expect(mockApi.ui.dialog.replace).not.toHaveBeenCalled();
  });

  it("should open DialogSelect with options when auth and telemetry succeed", async () => {
    await showQuotaDetailsDialog(
      mockApi as TuiPluginApi,
      mockAuthProvider as OpenCodeAuthProvider,
      mockTelemetryClient as CodexTelemetryClient,
      mockResetController as ResetController,
    );

    expect(mockApi.ui.dialog.setSize).toHaveBeenCalledWith("large");
    expect(mockApi.ui.dialog.replace).toHaveBeenCalledTimes(1);

    const renderFn = mockApi.ui.dialog.replace.mock.calls[0][0];
    const rendered = renderFn();

    expect(mockApi.ui.DialogSelect).toHaveBeenCalled();
    expect(rendered.props.title).toBe("OpenCode · Cuota y Límites de Codex");
    expect(rendered.props.options.length).toBeGreaterThan(0);
  });

  it("should handle confirm dialog and consume reset successfully", async () => {
    await showQuotaDetailsDialog(
      mockApi as TuiPluginApi,
      mockAuthProvider as OpenCodeAuthProvider,
      mockTelemetryClient as CodexTelemetryClient,
      mockResetController as ResetController,
    );

    const selectRenderFn = mockApi.ui.dialog.replace.mock.calls[0][0];
    const selectNode = selectRenderFn();
    const consumeOption = selectNode.props.options.find(
      (opt: any) => opt.value === "consume",
    );

    expect(consumeOption).toBeDefined();

    consumeOption.onSelect();

    expect(mockApi.ui.dialog.replace).toHaveBeenCalledTimes(2);
    const confirmRenderFn = mockApi.ui.dialog.replace.mock.calls[1][0];
    const confirmNode = confirmRenderFn();

    expect(mockApi.ui.DialogConfirm).toHaveBeenCalled();
    expect(confirmNode.props.title).toBe("Confirm Quota Reset");

    await confirmNode.props.onConfirm();

    expect(mockApi.ui.dialog.clear).toHaveBeenCalled();
    expect(mockResetController.consume).toHaveBeenCalledWith(VALID_CREDS, 1);
    expect(mockApi.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        message: "Reset applied!",
      }),
    );
  });

  it("should show error toast if resetController.consume fails on confirm", async () => {
    mockResetController.consume.mockResolvedValue({
      success: false,
      error: "No credits available",
    });

    await showQuotaDetailsDialog(
      mockApi as TuiPluginApi,
      mockAuthProvider as OpenCodeAuthProvider,
      mockTelemetryClient as CodexTelemetryClient,
      mockResetController as ResetController,
    );

    const selectRenderFn = mockApi.ui.dialog.replace.mock.calls[0][0];
    const selectNode = selectRenderFn();
    const consumeOption = selectNode.props.options.find(
      (opt: any) => opt.value === "consume",
    );

    consumeOption.onSelect();
    const confirmRenderFn = mockApi.ui.dialog.replace.mock.calls[1][0];
    const confirmNode = confirmRenderFn();

    await confirmNode.props.onConfirm();

    expect(mockApi.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        message: "No credits available",
      }),
    );
  });

  it("should clear dialog when cancel is pressed on Confirm dialog", async () => {
    await showQuotaDetailsDialog(
      mockApi as TuiPluginApi,
      mockAuthProvider as OpenCodeAuthProvider,
      mockTelemetryClient as CodexTelemetryClient,
      mockResetController as ResetController,
    );

    const selectRenderFn = mockApi.ui.dialog.replace.mock.calls[0][0];
    const selectNode = selectRenderFn();
    const consumeOption = selectNode.props.options.find(
      (opt: any) => opt.value === "consume",
    );

    consumeOption.onSelect();
    const confirmRenderFn = mockApi.ui.dialog.replace.mock.calls[1][0];
    const confirmNode = confirmRenderFn();

    confirmNode.props.onCancel();

    expect(mockApi.ui.dialog.clear).toHaveBeenCalled();
    expect(mockResetController.consume).not.toHaveBeenCalled();
  });
});

describe("showUsageDetailsDialog", () => {
  let mockApi: any;
  let mockAuthProvider: any;
  let mockTelemetryClient: any;

  beforeEach(() => {
    mockApi = {
      ui: {
        toast: vi.fn(),
        dialog: {
          replace: vi.fn(),
          clear: vi.fn(),
          setSize: vi.fn(),
        },
        DialogSelect: vi.fn((props) => ({ type: "DialogSelect", props })),
      },
    };

    mockAuthProvider = {
      getCredentials: vi.fn().mockResolvedValue({
        status: "valid",
        credentials: VALID_CREDS,
      }),
    };

    mockTelemetryClient = {
      getTelemetry: vi.fn().mockResolvedValue(SAMPLE_TELEMETRY),
      invalidateCache: vi.fn(),
    };
  });

  it("should open DialogSelect with usage options when invoked", async () => {
    await showUsageDetailsDialog(
      mockApi as TuiPluginApi,
      mockAuthProvider as OpenCodeAuthProvider,
      mockTelemetryClient as CodexTelemetryClient,
    );

    expect(mockApi.ui.dialog.setSize).toHaveBeenCalledWith("large");
    expect(mockApi.ui.dialog.replace).toHaveBeenCalledTimes(1);

    const renderFn = mockApi.ui.dialog.replace.mock.calls[0][0];
    const rendered = renderFn();

    expect(mockApi.ui.DialogSelect).toHaveBeenCalled();
    expect(rendered.props.title).toBe("OpenCode · Telemetría y Análisis de Consumo");
    expect(rendered.props.options.length).toBeGreaterThan(0);
  });
});
