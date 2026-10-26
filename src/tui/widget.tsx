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
      text: "Codex · ...",
      color: "gray",
      credits: 0,
      prefixText: "Codex",
      metaText: " · ...",
      plan: "Codex",
      pacing: {
        text: "...",
        color: "gray",
      },
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
    setBadge({
      text: "Codex · Err",
      color: "red",
      credits: 0,
      barText: "",
      filledBar: "",
      emptyBar: "",
      prefixText: "Codex",
      metaText: " · Err",
      plan: "Codex",
      pacing: {
        text: "Err",
        color: "red",
      },
    });
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

  // ── ROW 0: Plan & Pacing (e.g. Plus · Al ritmo previsto) ──
  const row0PlanProps = Object.create(null);
  Object.defineProperty(row0PlanProps, "fg", {
    get() {
      return isVisible() ? (displayBadge().color ?? "green") : "gray";
    },
    enumerable: true,
  });
  row0PlanProps.children = () => {
    if (!isVisible()) return "";
    return displayBadge().plan ?? "Codex";
  };

  const row0PacingProps = Object.create(null);
  Object.defineProperty(row0PacingProps, "fg", {
    get() {
      return isVisible() ? (displayBadge().pacing?.color ?? "green") : "gray";
    },
    enumerable: true,
  });
  row0PacingProps.children = () => {
    if (!isVisible()) return "";
    const p = displayBadge().pacing;
    return p?.text ? ` · ${p.text}` : "";
  };

  const row0Props = Object.create(null);
  row0Props.flexDirection = "row";
  Object.defineProperty(row0Props, "visible", {
    get() {
      return isVisible() && Boolean(displayBadge().primary);
    },
    enumerable: true,
  });
  row0Props.children = [
    _jsx("text", row0PlanProps),
    _jsx("text", row0PacingProps),
  ];

  // ── ROW 1: 5h Window (or single status line fallback) ──
  const row1LabelProps = Object.create(null);
  Object.defineProperty(row1LabelProps, "fg", {
    get() {
      return isVisible()
        ? (displayBadge().primary?.color ?? displayBadge().color)
        : "gray";
    },
    enumerable: true,
  });
  row1LabelProps.children = () => {
    if (!isVisible()) return "";
    const p = displayBadge().primary;
    if (p) return `${p.label} ${p.filledBar}`;
    return displayBadge().prefixText ?? displayBadge().text;
  };

  const row1EmptyProps = Object.create(null);
  row1EmptyProps.fg = "gray";
  row1EmptyProps.children = () => {
    if (!isVisible()) return "";
    return displayBadge().primary?.emptyBar ?? "";
  };

  const row1PctProps = Object.create(null);
  Object.defineProperty(row1PctProps, "fg", {
    get() {
      return isVisible() ? (displayBadge().primary?.color ?? "green") : "gray";
    },
    enumerable: true,
  });
  row1PctProps.children = () => {
    if (!isVisible()) return "";
    const p = displayBadge().primary;
    return p ? ` ${p.pctText}` : "";
  };

  const row1TimeProps = Object.create(null);
  row1TimeProps.fg = "gray";
  row1TimeProps.children = () => {
    if (!isVisible()) return "";
    const p = displayBadge().primary;
    if (p) return ` ${p.timeText}`;
    return displayBadge().metaText ?? "";
  };

  const row1Props = Object.create(null);
  row1Props.flexDirection = "row";
  row1Props.children = [
    _jsx("text", row1LabelProps),
    _jsx("text", row1EmptyProps),
    _jsx("text", row1PctProps),
    _jsx("text", row1TimeProps),
  ];

  // ── ROW 2: 7d Window (Weekly quota & credits) ──
  const row2LabelProps = Object.create(null);
  Object.defineProperty(row2LabelProps, "fg", {
    get() {
      return isVisible()
        ? (displayBadge().weekly?.color ?? "green")
        : "gray";
    },
    enumerable: true,
  });
  row2LabelProps.children = () => {
    if (!isVisible()) return "";
    const w = displayBadge().weekly;
    return w ? `${w.label} ${w.filledBar}` : "";
  };

  const row2EmptyProps = Object.create(null);
  row2EmptyProps.fg = "gray";
  row2EmptyProps.children = () => {
    if (!isVisible()) return "";
    return displayBadge().weekly?.emptyBar ?? "";
  };

  const row2PctProps = Object.create(null);
  Object.defineProperty(row2PctProps, "fg", {
    get() {
      return isVisible() ? (displayBadge().weekly?.color ?? "green") : "gray";
    },
    enumerable: true,
  });
  row2PctProps.children = () => {
    if (!isVisible()) return "";
    const w = displayBadge().weekly;
    return w ? ` ${w.pctText}` : "";
  };

  const row2TimeProps = Object.create(null);
  row2TimeProps.fg = "gray";
  row2TimeProps.children = () => {
    if (!isVisible()) return "";
    const w = displayBadge().weekly;
    return w ? ` ${w.timeText} ` : "";
  };

  const row2CreditsProps = Object.create(null);
  Object.defineProperty(row2CreditsProps, "fg", {
    get() {
      if (!isVisible()) return "gray";
      return displayBadge().credits > 0 ? "yellow" : "gray";
    },
    enumerable: true,
  });
  row2CreditsProps.children = () => {
    if (!isVisible()) return "";
    const w = displayBadge().weekly;
    return w ? `⚡${displayBadge().credits}` : "";
  };

  const row2Props = Object.create(null);
  row2Props.flexDirection = "row";
  Object.defineProperty(row2Props, "visible", {
    get() {
      return isVisible() && Boolean(displayBadge().weekly);
    },
    enumerable: true,
  });
  row2Props.children = [
    _jsx("text", row2LabelProps),
    _jsx("text", row2EmptyProps),
    _jsx("text", row2PctProps),
    _jsx("text", row2TimeProps),
    _jsx("text", row2CreditsProps),
  ];

  const boxProps = Object.create(null);
  boxProps.flexDirection = "column";
  Object.defineProperty(boxProps, "visible", {
    get() {
      return isVisible();
    },
    enumerable: true,
  });
  boxProps.children = [
    _jsx("box", row0Props),
    _jsx("box", row1Props),
    _jsx("box", row2Props),
  ];

  return _jsx("box", boxProps);
}
