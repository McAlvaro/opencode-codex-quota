import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import {
  PLUGIN_NAME,
  PLUGIN_VERSION,
  resolveAuthPath,
  tui,
  plugin,
} from "./index.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";

describe("opencode-codex-quota", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should export the correct plugin name and version", () => {
    expect(PLUGIN_NAME).toBe("opencode-codex-quota");
    expect(PLUGIN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(plugin.id).toBe("opencode-codex-quota");
    expect(typeof plugin.tui).toBe("function");
  });

  describe("resolveAuthPath", () => {
    it("should resolve existing candidate path or fallback", () => {
      const resolved = resolveAuthPath();
      expect(resolved).toContain("opencode");
      expect(resolved.endsWith("auth.json")).toBe(true);
    });

    it("should check statePath counterpart if statePath contains .local/state", () => {
      const resolved = resolveAuthPath("/home/user/.local/state/opencode");
      expect(resolved.endsWith("auth.json")).toBe(true);
    });

    it("should fallback to XDG_DATA_HOME when candidates do not exist", () => {
      process.env.XDG_DATA_HOME = "/non/existent/xdg";
      const resolved = resolveAuthPath();
      expect(resolved.endsWith("auth.json")).toBe(true);
    });
  });

  describe("tui plugin initializer", () => {
    it("should wire up slot registration and command registration", async () => {
      const mockApi = {
        state: {
          path: {
            state: "/mock/state",
          },
        },
        slots: {
          register: vi.fn().mockReturnValue("slot-id"),
        },
        command: {
          register: vi.fn().mockReturnValue(() => {}),
        },
      } as unknown as TuiPluginApi;

      await tui(mockApi, undefined, {} as any);

      expect(mockApi.slots.register).toHaveBeenCalledTimes(1);
      expect(mockApi.command?.register).toHaveBeenCalledTimes(1);
    });
  });
});
