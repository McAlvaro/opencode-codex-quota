/** @jsxImportSource @opentui/solid */
import { createSignal, onCleanup, onMount } from "solid-js";
import { formatBadge, type QuotaBadge } from "./format.js";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";

export interface CodexQuotaWidgetProps {
  authProvider: OpenCodeAuthProvider;
  telemetryClient: CodexTelemetryClient;
  pollIntervalMs?: number;
}

export function CodexQuotaWidget(props: CodexQuotaWidgetProps) {
  const [badge, setBadge] = createSignal<QuotaBadge>({
    text: "[Codex: ...]",
    color: "gray",
  });

  const pollInterval = props.pollIntervalMs ?? 30_000;

  async function update() {
    try {
      const authResult = await props.authProvider.getCredentials();
      if (authResult.status !== "valid") {
        setBadge(formatBadge(null, authResult.status));
        return;
      }

      const telemetry = await props.telemetryClient.getTelemetry(
        authResult.credentials,
      );
      setBadge(formatBadge(telemetry, "valid"));
    } catch {
      setBadge({ text: "[Codex: Err]", color: "red" });
    }
  }

  onMount(() => {
    void update();
    const timer = setInterval(() => {
      void update();
    }, pollInterval);

    onCleanup(() => clearInterval(timer));
  });

  return (
    <box flexDirection="row">
      <text fg={badge().color}>{badge().text}</text>
    </box>
  );
}
