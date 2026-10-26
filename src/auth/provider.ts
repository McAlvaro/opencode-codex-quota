import {
  AuthStoreSchema,
  type AuthResult,
  type ValidCredentials,
} from "../domain/models.js";

const EXPIRY_BUFFER_MS = 30_000;

export interface AuthDeps {
  readFile: (path: string) => Promise<string>;
  now: () => number;
}

const defaultDeps: AuthDeps = {
  readFile: async (path) => {
    const { readFile } = await import("node:fs/promises");
    return readFile(path, "utf-8");
  },
  now: () => Date.now(),
};

export class OpenCodeAuthProvider {
  constructor(
    private readonly authPath: string,
    private readonly deps: AuthDeps = defaultDeps,
  ) {}

  async getCredentials(): Promise<AuthResult> {
    let raw: string;

    try {
      raw = await this.deps.readFile(this.authPath);
    } catch {
      return { status: "missing-file" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: "invalid-schema" };
    }

    const obj = parsed as Record<string, unknown>;

    if (!obj.openai) {
      return { status: "missing-openai" };
    }

    const storeResult = AuthStoreSchema.safeParse(parsed);
    if (!storeResult.success) {
      return { status: "invalid-schema" };
    }

    const { openai } = storeResult.data;
    if (!openai) {
      return { status: "missing-openai" };
    }

    if (this.deps.now() >= openai.expires - EXPIRY_BUFFER_MS) {
      return { status: "expired" };
    }

    const credentials: ValidCredentials = {
      accessToken: openai.access,
      accountId: openai.accountId,
      expiresAt: openai.expires,
    };

    return { status: "valid", credentials };
  }
}
