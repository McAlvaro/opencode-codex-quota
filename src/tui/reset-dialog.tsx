/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";
import type { ResetController } from "../actions/reset-controller.js";
import {
  buildQuotaCardOptions,
  buildUsageCardOptions,
} from "./dialog-options.js";

/**
 * Shows the Quota & Limits card dialog (`/codex-quota`).
 * Focuses on visual capacity gauges, reset countdowns, and reset credit redemption.
 */
export async function showQuotaDetailsDialog(
  api: TuiPluginApi,
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
  resetController: ResetController,
): Promise<void> {
  const authResult = await authProvider.getCredentials();
  if (authResult.status !== "valid") {
    api.ui.toast({
      variant: "error",
      title: "Codex Quota",
      message: `Authentication issue: ${authResult.status}`,
    });
    return;
  }

  const telemetry = await telemetryClient.getTelemetry(
    authResult.credentials,
    true,
  );
  if (!telemetry) {
    api.ui.toast({
      variant: "error",
      title: "Codex Quota",
      message: "Failed to retrieve quota telemetry from ChatGPT backend",
    });
    return;
  }

  const openConfirmDialog = () => {
    if (telemetry.availableResetCredits <= 0) {
      api.ui.toast({
        variant: "warning",
        title: "Codex Quota",
        message: "No tienes créditos de reseteo disponibles en esta cuenta.",
      });
      return;
    }
    api.ui.dialog.replace(() => (
      <api.ui.DialogConfirm
        title="Confirm Quota Reset"
        message={`Are you sure you want to redeem 1 reset credit? You currently have ${telemetry.availableResetCredits} available.`}
        onConfirm={async () => {
          api.ui.dialog.clear();
          const res = await resetController.consume(
            authResult.credentials,
            telemetry.availableResetCredits,
          );
          if (res.success) {
            api.ui.toast({
              variant: "success",
              title: "Codex Quota",
              message: res.message ?? "Quota window reset successfully!",
            });
          } else {
            api.ui.toast({
              variant: "error",
              title: "Codex Quota",
              message: res.error ?? "Failed to reset quota.",
            });
          }
        }}
        onCancel={() => {
          api.ui.dialog.clear();
        }}
      />
    ));
  };

  const handleRefresh = async () => {
    api.ui.toast({
      variant: "info",
      title: "Codex Quota",
      message: "Sincronizando límites con ChatGPT...",
    });
    telemetryClient.invalidateCache();
    await showQuotaDetailsDialog(api, authProvider, telemetryClient, resetController);
  };

  const options = buildQuotaCardOptions(telemetry, {
    onConsume: openConfirmDialog,
    onRefresh: handleRefresh,
    onClose: () => {
      api.ui.dialog.clear();
    },
  });

  api.ui.dialog.setSize("large");
  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="OpenCode · Cuota y Límites de Codex"
      placeholder="Explora límites de cuota o canjea un crédito de reseteo..."
      options={options}
    />
  ));
}

/**
 * Shows the Usage & Telemetry card dialog (`/codex-usage`).
 * Focuses on burn rate (pacing), analytical percentages, system health, and diagnostics.
 */
export async function showUsageDetailsDialog(
  api: TuiPluginApi,
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
): Promise<void> {
  const authResult = await authProvider.getCredentials();
  if (authResult.status !== "valid") {
    api.ui.toast({
      variant: "error",
      title: "Codex Usage",
      message: `Authentication issue: ${authResult.status}`,
    });
    return;
  }

  const telemetry = await telemetryClient.getTelemetry(
    authResult.credentials,
    true,
  );
  if (!telemetry) {
    api.ui.toast({
      variant: "error",
      title: "Codex Usage",
      message: "Failed to retrieve telemetry data from ChatGPT backend",
    });
    return;
  }

  const handleRefresh = async () => {
    api.ui.toast({
      variant: "info",
      title: "Codex Usage",
      message: "Actualizando telemetría y diagnóstico...",
    });
    telemetryClient.invalidateCache();
    await showUsageDetailsDialog(api, authProvider, telemetryClient);
  };

  const options = buildUsageCardOptions(telemetry, {
    onRefresh: handleRefresh,
    onClose: () => {
      api.ui.dialog.clear();
    },
  });

  api.ui.dialog.setSize("large");
  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="OpenCode · Telemetría y Análisis de Consumo"
      placeholder="Consulta telemetría detallada, velocidad y diagnósticos..."
      options={options}
    />
  ));
}
