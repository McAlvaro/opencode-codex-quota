import { describe, it, expect } from "vitest";
import { PLUGIN_NAME, PLUGIN_VERSION } from "./index.js";

describe("opencode-codex-quota", () => {
  it("should export the correct plugin name", () => {
    expect(PLUGIN_NAME).toBe("opencode-codex-quota");
  });

  it("should export a valid semver version", () => {
    expect(PLUGIN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
