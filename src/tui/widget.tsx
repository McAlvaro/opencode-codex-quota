/** @jsxImportSource @opentui/solid */
import { jsx as _jsx } from "@opentui/solid/jsx-runtime";
import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";
import fs from "node:fs";
import { formatBadge, type QuotaBadge } from "./format.js";
import { createIsOpenAISignal, isOpenAIActive } from "./model-filter.js";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";

export interface CodexQuotaWidgetProps {
  authProvider: OpenCodeAuthProvider;
  telemetryClient: CodexTelemetryClient;
  pollIntervalMs?: number;
  badge?: Accessor<QuotaBadge>;
  api?: TuiPluginApi;
  sessionID?: string;
  isOpenAI?: boolean | (() => boolean);
}

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

let sharedBadge: Accessor<QuotaBadge> | null = null;
let setSharedBadge: ((badge: QuotaBadge) => void) | null = null;
let pollTimer: NodeJS.Timeout | null = null;

export function getOrCreateSharedBadgeSignal() {
  if (!sharedBadge || !setSharedBadge) {
    const [b, setB] = createSignal<QuotaBadge>({
      text: "[Codex: ...]",
      color: "gray",
    });
    sharedBadge = b;
    setSharedBadge = setB;
  }
  return { badge: sharedBadge, setBadge: setSharedBadge };
}

export function resetSharedBadgeState() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  sharedBadge = null;
  setSharedBadge = null;
}

export async function updateQuotaBadge(
  authProvider: OpenCodeAuthProvider,
  telemetryClient: CodexTelemetryClient,
): Promise<void> {
  const { setBadge } = getOrCreateSharedBadgeSignal();
  debugLog("updateQuotaBadge() started");
  try {
    const authResult = await authProvider.getCredentials();
    debugLog(`authResult status: ${authResult.status}`);
    if (authResult.status !== "valid") {
      const fallback = formatBadge(null, authResult.status);
      setBadge(fallback);
      debugLog(`Set fallback badge: ${JSON.stringify(fallback)}`);
      return;
    }

    const telemetry = await telemetryClient.getTelemetry(
      authResult.credentials,
    );
    debugLog(`telemetry returned: ${JSON.stringify(telemetry)}`);
    const newBadge = formatBadge(telemetry, "valid");
    setBadge(newBadge);
    debugLog(`Set active badge: ${JSON.stringify(newBadge)}`);
  } catch (err) {
    debugLog(
      `update error: ${err instanceof Error ? err.stack : String(err)}`,
    );
    setBadge({ text: "[Codex: Err]", color: "red" });
  }
}

export function isWidgetVisible(props: CodexQuotaWidgetProps): boolean {
  if (typeof props.isOpenAI === "boolean") {
    return props.isOpenAI;
  }
  if (typeof props.isOpenAI === "function") {
    return props.isOpenAI();
  }
  return isOpenAIActive(props.api, props.sessionID);
}

export function CodexQuotaWidget(props: CodexQuotaWidgetProps) {
  const { badge } = getOrCreateSharedBadgeSignal();
  const pollInterval = props.pollIntervalMs ?? 30_000;
  const isOpenAIRef = createIsOpenAISignal(props.api, props.sessionID);

  const isVisible = () => {
    if (typeof props.isOpenAI === "boolean") {
      return props.isOpenAI;
    }
    if (typeof props.isOpenAI === "function") {
      return props.isOpenAI();
    }
    return isOpenAIRef();
  };

  // Only trigger update if OpenAI is active
  if (isVisible()) {
    void updateQuotaBadge(props.authProvider, props.telemetryClient);
  }

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      if (isVisible()) {
        void updateQuotaBadge(props.authProvider, props.telemetryClient);
      }
    }, pollInterval);
  }

  onMount(() => {
    debugLog("CodexQuotaWidget onMount fired");
    if (isVisible()) {
      void updateQuotaBadge(props.authProvider, props.telemetryClient);
    }
  });

  onCleanup(() => {
    debugLog("CodexQuotaWidget onCleanup fired");
  });

  const displayBadge = props.badge ?? badge;

  const textProps = Object.create(null);
  Object.defineProperty(textProps, "fg", {
    get() {
      return isVisible() ? displayBadge().color : "gray";
    },
    enumerable: true,
  });
  textProps.children = () => (isVisible() ? displayBadge().text : "");

  const boxProps = Object.create(null);
  boxProps.flexDirection = "row";
  Object.defineProperty(boxProps, "visible", {
    get() {
      return isVisible();
    },
    enumerable: true,
  });
  boxProps.children = _jsx("text", textProps);

  return _jsx("box", boxProps);
}
