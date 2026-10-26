/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { CodexQuotaWidget } from "./widget.js";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";

export interface SlotRegistrationOptions {
  pollIntervalMs?: number;
  slot?: "sidebar_footer" | "session_prompt_right" | "both";
}

export function registerQuotaSlots(
  api: TuiPluginApi,
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
  options?: SlotRegistrationOptions,
): string {
  const chosenSlot =
    options?.slot ??
    (process.env.OPENCODE_CODEX_QUOTA_SLOT as
      | "sidebar_footer"
      | "session_prompt_right"
      | "both"
      | undefined) ??
    "sidebar_footer";

  const renderWidget = (ctx?: any) => (
    <CodexQuotaWidget
      api={api}
      sessionID={ctx?.session_id}
      authProvider={authProvider}
      telemetryClient={telemetryClient}
      pollIntervalMs={options?.pollIntervalMs}
    />
  );

  const slotsToRegister: Record<string, (ctx?: any) => any> = {};

  if (chosenSlot === "sidebar_footer" || chosenSlot === "both") {
    slotsToRegister.sidebar_footer = renderWidget;
  }
  if (chosenSlot === "session_prompt_right" || chosenSlot === "both") {
    slotsToRegister.session_prompt_right = renderWidget;
  }

  return api.slots.register({
    slots: slotsToRegister,
  });
}
