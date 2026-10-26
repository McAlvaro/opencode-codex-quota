/**
 * opencode-codex-quota
 *
 * OpenCode TUI plugin entry point.
 * Monitors ChatGPT Codex subscription quota and provides
 * on-demand rate-limit reset capabilities.
 */

import path from "node:path";
import os from "node:os";
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { OpenCodeAuthProvider } from "./auth/provider.js";
import { CodexTelemetryClient } from "./telemetry/client.js";
import { ResetController } from "./actions/reset-controller.js";
import { registerQuotaSlots } from "./tui/slot.js";
import { registerQuotaCommands } from "./tui/commands.js";

export const PLUGIN_NAME = "opencode-codex-quota" as const;
export const PLUGIN_VERSION = "0.1.0" as const;

export function resolveAuthPath(statePath?: string): string {
  if (statePath) {
    return path.join(statePath, "auth.json");
  }
  const xdgData = process.env.XDG_DATA_HOME;
  if (xdgData) {
    return path.join(xdgData, "opencode", "auth.json");
  }
  return path.join(os.homedir(), ".local", "share", "opencode", "auth.json");
}

export const tui: TuiPlugin = async (api) => {
  const authPath = resolveAuthPath(api.state?.path?.state);
  const authProvider = new OpenCodeAuthProvider(authPath);
  const telemetryClient = new CodexTelemetryClient();
  const resetController = new ResetController(telemetryClient);

  registerQuotaSlots(api, authProvider, telemetryClient);
  registerQuotaCommands(api, authProvider, telemetryClient, resetController);
};

export const plugin: TuiPluginModule = {
  id: PLUGIN_NAME,
  tui,
};

export default plugin;

export * from "./domain/models.js";
export * from "./auth/provider.js";
export * from "./telemetry/client.js";
export * from "./actions/reset-controller.js";
export * from "./tui/format.js";
export * from "./tui/widget.js";
export * from "./tui/slot.js";
export * from "./tui/dialog-options.js";
export * from "./tui/reset-dialog.js";
export * from "./tui/commands.js";
