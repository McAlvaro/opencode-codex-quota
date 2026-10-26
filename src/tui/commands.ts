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
    title: "Codex Quota: Ver uso y tarjeta detallada",
    value: "codex.quota",
    category: "Codex",
    description:
      "Tarjeta Moshi: Plan, ventanas 5h y 7d, ritmo y créditos de reseteo",
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

export function createUsageCommand(
  api: TuiPluginApi,
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
  resetController: ResetController,
): TuiCommand {
  return {
    title: "Codex Usage: View Quota Telemetry & Reset",
    value: "codex.usage",
    category: "Codex",
    description:
      "Inspect 5-hour rolling windows and consume rate limit reset credits",
    slash: {
      name: "codex-usage",
      aliases: ["usage"],
    },
    onSelect: () => {
      debugLog("Command 'codex-usage' selected");
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

  debugLog("registerQuotaCommands: registering /codex-quota and /codex-usage");
  return api.command.register(() => [
    createQuotaCommand(api, authProvider, telemetryClient, resetController),
    createUsageCommand(api, authProvider, telemetryClient, resetController),
  ]);
}
