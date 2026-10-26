import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { createSignal, createMemo, type Accessor } from "solid-js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";

export interface ModelRefCandidate {
  providerID?: string;
  modelID?: string;
  id?: string;
}

export function isProviderOpenAI(providerID?: string): boolean {
  if (!providerID) return false;
  return providerID.toLowerCase().trim() === "openai";
}

export function isModelOpenAI(candidate?: ModelRefCandidate | null): boolean {
  if (!candidate) return false;

  if (candidate.providerID) {
    return isProviderOpenAI(candidate.providerID);
  }

  const modelName = candidate.modelID ?? candidate.id;
  if (!modelName) return false;

  const trimmed = modelName.toLowerCase().trim();
  if (trimmed.startsWith("openai/")) {
    return true;
  }
  if (trimmed.includes("/")) {
    return false;
  }

  return (
    trimmed.startsWith("gpt-") ||
    trimmed.startsWith("codex") ||
    trimmed.startsWith("o1") ||
    trimmed.startsWith("o3") ||
    trimmed.startsWith("o4")
  );
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

export function resolveActiveModel(
  api?: TuiPluginApi,
  sessionID?: string,
): ModelRefCandidate | null {
  if (!api) return null;

  // 1. OpenCode state-level model.json (~/.local/state/opencode/model.json)
  // This reflects the active/recent model selection in the TUI prompt in real time
  const stateDir =
    api.state?.path?.state ??
    path.join(os.homedir(), ".local", "state", "opencode");

  try {
    const modelJsonPath = path.join(stateDir, "model.json");
    if (fs.existsSync(modelJsonPath)) {
      const content = fs.readFileSync(modelJsonPath, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed?.recent) && parsed.recent.length > 0) {
        const first = parsed.recent[0];
        if (first && typeof first === "object") {
          return {
            providerID: first.providerID,
            modelID: first.modelID ?? first.id,
          };
        }
      }
    }
  } catch {
    // Ignore file read or parse issues
  }

  // 2. Session-level model
  const sid =
    sessionID ??
    (api.route?.current?.name === "session"
      ? (api.route.current.params as Record<string, unknown> | undefined)
          ?.sessionID
      : undefined);

  if (typeof sid === "string" && api.state?.session?.get) {
    const session = api.state.session.get(sid);
    if (session?.model) {
      return {
        providerID: session.model.providerID,
        modelID: session.model.id,
      };
    }
  }

  // 3. Config-level fallback (config.model)
  const configModel = api.state?.config?.model;
  if (typeof configModel === "string") {
    if (configModel.includes("/")) {
      const [providerID, modelID] = configModel.split("/");
      return { providerID, modelID };
    }
    return { modelID: configModel };
  }

  return null;
}

export function isOpenAIActive(
  api?: TuiPluginApi,
  sessionID?: string,
): boolean {
  const model = resolveActiveModel(api, sessionID);
  return isModelOpenAI(model);
}

// ── Reactive Solid Signals for Model Tracking ────────────────────────

let modelSignal: [Accessor<ModelRefCandidate | null>, (m: ModelRefCandidate | null) => void] | null = null;

export function getOrCreateActiveModelSignal(api?: TuiPluginApi) {
  if (!modelSignal) {
    const initial = resolveActiveModel(api);
    const [model, setModel] = createSignal<ModelRefCandidate | null>(initial);
    modelSignal = [model, setModel];
  }
  return {
    model: modelSignal[0],
    setModel: modelSignal[1],
  };
}

export function resetActiveModelSignal(): void {
  modelSignal = null;
}

export function createIsOpenAISignal(
  api?: TuiPluginApi,
  sessionID?: string,
): Accessor<boolean> {
  const { model } = getOrCreateActiveModelSignal(api);
  return createMemo(() => {
    const m = model();
    return isModelOpenAI(m);
  });
}

export function initModelWatcher(
  api: TuiPluginApi,
  onOpenAIActivated?: () => void,
): () => void {
  const { setModel } = getOrCreateActiveModelSignal(api);

  let lastSignature = "";

  const check = () => {
    const current = resolveActiveModel(api);
    const sig = JSON.stringify(current);
    if (sig !== lastSignature) {
      const wasOpenAI = lastSignature
        ? isModelOpenAI(JSON.parse(lastSignature))
        : false;
      const isNowOpenAI = isModelOpenAI(current);

      lastSignature = sig;
      debugLog(`Model changed: ${sig}, isOpenAI: ${isNowOpenAI}`);
      setModel(current);

      if (!wasOpenAI && isNowOpenAI) {
        debugLog("OpenAI model activated, triggering immediate quota refresh");
        onOpenAIActivated?.();
      }
    }
  };

  // Immediate check
  check();

  // Polling check every 300ms for file-level or state-level model changes
  const timer = setInterval(check, 300);

  // Subscribe to OpenCode event bus
  const unsubs: Array<() => void> = [];
  if (api.event?.on) {
    try {
      unsubs.push(
        api.event.on("session.next.model.switched" as any, (evt: any) => {
          if (evt?.properties?.model) {
            const m = {
              providerID: evt.properties.model.providerID,
              modelID: evt.properties.model.id,
            };
            lastSignature = JSON.stringify(m);
            debugLog(`Event session.next.model.switched: ${lastSignature}`);
            setModel(m);
          } else {
            check();
          }
        }),
      );
      unsubs.push(api.event.on("session.updated" as any, check));
      unsubs.push(api.event.on("session.created" as any, check));
    } catch {
      // Ignore
    }
  }

  // Watch model.json directly
  const stateDir =
    api.state?.path?.state ??
    path.join(os.homedir(), ".local", "state", "opencode");
  const modelJsonPath = path.join(stateDir, "model.json");

  try {
    if (fs.existsSync(modelJsonPath)) {
      fs.watchFile(modelJsonPath, { interval: 200 }, () => {
        check();
      });
    }
  } catch {
    // Ignore watch issues
  }

  return () => {
    clearInterval(timer);
    for (const u of unsubs) {
      u();
    }
    try {
      fs.unwatchFile(modelJsonPath);
    } catch {}
  };
}
