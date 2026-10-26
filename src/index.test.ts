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
    it("should use statePath when provided by OpenCode API", () => {
      const resolved = resolveAuthPath("/custom/state/dir");
      expect(resolved).toBe("/custom/state/dir/auth.json");
    });

    it("should fallback to XDG_DATA_HOME when statePath is undefined", () => {
      process.env.XDG_DATA_HOME = "/custom/xdg";
      const resolved = resolveAuthPath();
      expect(resolved).toBe("/custom/xdg/opencode/auth.json");
    });

    it("should fallback to ~/.local/share/opencode when no env is set", () => {
      delete process.env.XDG_DATA_HOME;
      const resolved = resolveAuthPath();
      const expected = path.join(
        os.homedir(),
        ".local",
        "share",
        "opencode",
        "auth.json",
      );
      expect(resolved).toBe(expected);
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
