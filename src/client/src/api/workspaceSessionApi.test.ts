import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceSession } from "./workspaceSessionApi";

const session = {
  userId: "user-123",
  preferredUsername: "Taylor User",
  email: "taylor@example.com",
  workspace: {
    id: "workspace-456",
    host: "https://workspace.example.com",
  },
  authenticationMode: "databricks",
  installationAdmin: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getWorkspaceSession", () => {
  it("loads and validates the token-free session from the same origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => session,
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(getWorkspaceSession(controller.signal)).resolves.toEqual(
      expect.objectContaining({ userId: "user-123", workspace: session.workspace }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/session",
      expect.objectContaining({
        credentials: "same-origin",
        signal: controller.signal,
      }),
    );
  });

  it("rejects incomplete session data instead of rendering guessed identity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...session, userId: " " }),
    }));

    await expect(getWorkspaceSession()).rejects.toThrow(
      "invalid session response",
    );
  });

  it("surfaces a sanitized server problem detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Open VDAB through Databricks." }),
    }));

    await expect(getWorkspaceSession()).rejects.toThrow(
      "Open VDAB through Databricks.",
    );
  });
});
