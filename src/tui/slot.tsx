/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { CodexQuotaWidget } from "./widget.js";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";

export interface SlotRegistrationOptions {
  pollIntervalMs?: number;
}

export function registerQuotaSlots(
  api: TuiPluginApi,
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
  options?: SlotRegistrationOptions,
): string {
  return api.slots.register({
    slots: {
      sidebar_footer: () => (
        <CodexQuotaWidget
          authProvider={authProvider}
          telemetryClient={telemetryClient}
          pollIntervalMs={options?.pollIntervalMs}
        />
      ),
      session_prompt_right: () => (
        <CodexQuotaWidget
          authProvider={authProvider}
          telemetryClient={telemetryClient}
          pollIntervalMs={options?.pollIntervalMs}
        />
      ),
    },
  });
}
