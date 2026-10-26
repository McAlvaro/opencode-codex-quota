import fs from "node:fs";
import type { TuiPluginApi, TuiCommand } from "@opencode-ai/plugin/tui";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";
import type { ResetController } from "../actions/reset-controller.js";
import { showQuotaDetailsDialog } from "./reset-dialog.js";

function debugLog(msg: string) {
  try {
    fs.appendFileSync(
      "/tmp/opencode-quota-debug.log",
      `[${new Date().toISOString()}] ${msg}\n`,
    );
  } catch {
    // Ignore logging failures
  }
}

export function createQuotaCommand(
  api: TuiPluginApi,
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
  resetController: ResetController,
): TuiCommand {
  return {
    title: "Codex Quota: Ver límites y cuota",
    value: "codex.quota",
    category: "Codex",
    description:
      "Tarjeta de límites: Barras 5h y 7d, plan, ritmo y canje de créditos",
    slash: {
      name: "codex-quota",
      aliases: ["quota", "codex"],
    },
    onSelect: () => {
      debugLog("Command 'codex-quota' selected");
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
    debugLog("registerQuotaCommands: api.command.register is not available");
    return undefined;
  }

  debugLog("registerQuotaCommands: registering /codex-quota");
  return api.command.register(() => [
    createQuotaCommand(api, authProvider, telemetryClient, resetController),
  ]);
}
