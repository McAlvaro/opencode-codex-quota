/**
 * opencode-codex-quota
 *
 * OpenCode TUI plugin entry point.
 * Monitors ChatGPT Codex subscription quota and provides
 * on-demand rate-limit reset capabilities.
 */

export const PLUGIN_NAME = "opencode-codex-quota" as const;
export const PLUGIN_VERSION = "0.1.0" as const;

export * from "./domain/models.js";
export * from "./auth/provider.js";
export * from "./telemetry/client.js";
export * from "./actions/reset-controller.js";
export * from "./tui/format.js";
export * from "./tui/widget.js";
export * from "./tui/slot.js";
