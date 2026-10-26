/**
 * opencode-codex-quota
 *
 * OpenCode TUI plugin entry point.
 * Monitors ChatGPT Codex subscription quota and provides
 * on-demand rate-limit reset capabilities.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { createRoot } from "solid-js";
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { OpenCodeAuthProvider } from "./auth/provider.js";
import { CodexTelemetryClient } from "./telemetry/client.js";
import { ResetController } from "./actions/reset-controller.js";
import { registerQuotaSlots } from "./tui/slot.js";
import { registerQuotaCommands } from "./tui/commands.js";

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

export const PLUGIN_NAME = "opencode-codex-quota" as const;
export const PLUGIN_VERSION = "0.1.0" as const;

export function resolveAuthPath(statePath?: string): string {
  const candidates: string[] = [];

  // 1. Standard XDG Data directory (~/.local/share/opencode/auth.json)
  const xdgData = process.env.XDG_DATA_HOME;
  if (xdgData) {
    candidates.push(path.join(xdgData, "opencode", "auth.json"));
  }
  candidates.push(
    path.join(os.homedir(), ".local", "share", "opencode", "auth.json"),
  );

  // 2. OpenCode state path & share counterpart if it points to .local/state
  if (statePath) {
    candidates.push(path.join(statePath, "auth.json"));
    if (statePath.includes(".local/state")) {
      candidates.push(
        path.join(statePath.replace(".local/state", ".local/share"), "auth.json"),
      );
    }
  }

  // 3. Config directory fallback (~/.config/opencode/auth.json)
  candidates.push(
    path.join(os.homedir(), ".config", "opencode", "auth.json"),
  );

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore
    }
  }

  return (
    candidates[0] ??
    path.join(os.homedir(), ".local", "share", "opencode", "auth.json")
  );
}

export const tui: TuiPlugin = async (api) => {
  debugLog("tui plugin initialized");
  createRoot((disposeRoot) => {
    const authPath = resolveAuthPath(api.state?.path?.state);
    debugLog(`resolved authPath: ${authPath}`);
    const authProvider = new OpenCodeAuthProvider(authPath);
    const telemetryClient = new CodexTelemetryClient();
    const resetController = new ResetController(telemetryClient);

    api.lifecycle?.onDispose?.(() => {
      debugLog("api.lifecycle.onDispose fired");
      disposeRoot();
    });

    registerQuotaSlots(api, authProvider, telemetryClient);
    registerQuotaCommands(api, authProvider, telemetryClient, resetController);
  });
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
