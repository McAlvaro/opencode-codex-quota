import { describe, it, expect, vi } from "vitest";
import {
  createQuotaCommand,
  createUsageCommand,
  registerQuotaCommands,
} from "./commands.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { OpenCodeAuthProvider } from "../auth/provider.js";
import type { CodexTelemetryClient } from "../telemetry/client.js";
import type { ResetController } from "../actions/reset-controller.js";

vi.mock("./reset-dialog.js", () => ({
  showQuotaDetailsDialog: vi.fn(),
}));

describe("TUI Commands", () => {
  const mockApi = {
    command: {
      register: vi.fn().mockReturnValue(() => {}),
    },
    ui: {
      toast: vi.fn(),
      dialog: {
        replace: vi.fn(),
        clear: vi.fn(),
      },
    },
  } as unknown as TuiPluginApi;

  const mockAuthProvider = {} as OpenCodeAuthProvider;
  const mockTelemetryClient = {} as CodexTelemetryClient;
  const mockResetController = {} as ResetController;

  describe("createQuotaCommand", () => {
    it("should return the /codex-quota command metadata", async () => {
      const cmd = createQuotaCommand(
        mockApi,
        mockAuthProvider,
        mockTelemetryClient,
        mockResetController,
      );

      expect(cmd.value).toBe("codex.quota");
      expect(cmd.slash?.name).toBe("codex-quota");
      expect(cmd.slash?.aliases).toContain("quota");
      expect(typeof cmd.onSelect).toBe("function");

      cmd.onSelect?.();
      const { showQuotaDetailsDialog } = await import("./reset-dialog.js");
      expect(showQuotaDetailsDialog).toHaveBeenCalledWith(
        mockApi,
        mockAuthProvider,
        mockTelemetryClient,
        mockResetController,
      );
    });
  });

  describe("createUsageCommand", () => {
    it("should return the /codex-usage command metadata", async () => {
      const cmd = createUsageCommand(
        mockApi,
        mockAuthProvider,
        mockTelemetryClient,
        mockResetController,
      );

      expect(cmd.value).toBe("codex.usage");
      expect(cmd.slash?.name).toBe("codex-usage");
      expect(cmd.slash?.aliases).toContain("usage");
      expect(typeof cmd.onSelect).toBe("function");

      cmd.onSelect?.();
      const { showQuotaDetailsDialog } = await import("./reset-dialog.js");
      expect(showQuotaDetailsDialog).toHaveBeenCalledWith(
        mockApi,
        mockAuthProvider,
        mockTelemetryClient,
        mockResetController,
      );
    });
  });

  describe("registerQuotaCommands", () => {
    it("should register both /codex-quota and /codex-usage through api.command.register", () => {
      let registeredCommands: any[] = [];
      const apiWithCommand = {
        command: {
          register: vi.fn().mockImplementation((factory) => {
            registeredCommands = factory();
            return () => {};
          }),
        },
      } as unknown as TuiPluginApi;

      const unregister = registerQuotaCommands(
        apiWithCommand,
        mockAuthProvider,
        mockTelemetryClient,
        mockResetController,
      );

      expect(unregister).toBeDefined();
      expect(apiWithCommand.command?.register).toHaveBeenCalledTimes(1);
      expect(registeredCommands.length).toBe(2);
      expect(registeredCommands[0].slash?.name).toBe("codex-quota");
      expect(registeredCommands[1].slash?.name).toBe("codex-usage");
    });

    it("should return undefined if api.command is absent", () => {
      const apiWithoutCommand = {} as TuiPluginApi;
      const unregister = registerQuotaCommands(
        apiWithoutCommand,
        mockAuthProvider,
        mockTelemetryClient,
        mockResetController,
      );

      expect(unregister).toBeUndefined();
    });
  });
});
