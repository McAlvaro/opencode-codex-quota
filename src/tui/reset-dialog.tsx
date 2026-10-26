/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";
import type { ResetController } from "../actions/reset-controller.js";
import { buildQuotaDialogOptions } from "./dialog-options.js";

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

  const options = buildQuotaDialogOptions(telemetry, {
    onConsume: openConfirmDialog,
    onClose: () => {
      api.ui.dialog.clear();
    },
  });

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="OpenCode Codex Quota & Usage"
      placeholder="Select an action or view telemetry..."
      options={options}
    />
  ));
}
