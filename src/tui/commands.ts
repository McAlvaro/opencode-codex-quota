import type { TuiPluginApi, TuiCommand } from "@opencode-ai/plugin/tui";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";
import type { ResetController } from "../actions/reset-controller.js";
import { showQuotaDetailsDialog } from "./reset-dialog.js";

export function createQuotaCommand(
  api: TuiPluginApi,
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
  resetController: ResetController,
): TuiCommand {
  return {
    title: "Codex Quota: View Usage & Reset",
    value: "codex.usage",
    category: "Codex",
    description:
      "Inspect 5-hour rolling windows and consume rate limit reset credits",
    slash: {
      name: "codex-usage",
      aliases: ["codex-quota", "quota"],
    },
    onSelect: () => {
      void showQuotaDetailsDialog(
        api,
        authProvider,
        telemetryClient,
        resetController,
      );
    },
  };
}

export function registerQuotaCommands(
  api: TuiPluginApi,
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
  resetController: ResetController,
): (() => void) | undefined {
  if (!api.command?.register) {
    return undefined;
  }

  return api.command.register(() => [
    createQuotaCommand(api, authProvider, telemetryClient, resetController),
  ]);
}
