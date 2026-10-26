import path from "node:path";
import os from "node:os";
import fs from "node:fs";
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

export function resolveActiveModel(
  api?: TuiPluginApi,
  sessionID?: string,
): ModelRefCandidate | null {
  if (!api) return null;

  // 1. Session-level model (highest priority)
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

  // 2. OpenCode state-level model.json (~/.local/state/opencode/model.json)
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
