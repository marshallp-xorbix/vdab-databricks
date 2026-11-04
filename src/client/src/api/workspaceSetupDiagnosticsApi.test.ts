import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceSetupDiagnostics } from "./workspaceSetupDiagnosticsApi";

const diagnostics = {
  lakebase: {
    status: "configured",
    configuredFields: ["LAKEBASE_ENDPOINT", "PGHOST"],
    missingFields: [],
    message: "Configuration present.",
  },
  defaultSqlWarehouse: {
    status: "configured",
    message: "Workspace SQL warehouse identifier is present.",
  },
  authorization: {
    status: "missing-scopes",
    requestedScopes: ["apps", "sql"],
    effectiveScopes: ["apps", "sql"],
    consentedScopes: ["apps"],
    missingScopes: ["sql"],
    message: "Consent is required.",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getWorkspaceSetupDiagnostics", () => {
  it("requests the explicit same-origin diagnostics check and validates its result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => diagnostics,
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await getWorkspaceSetupDiagnostics(controller.signal);

    expect(result.authorization.missingScopes).toEqual(["sql"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/setup/diagnostics",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        signal: controller.signal,
      }),
    );
  });

  it("rejects incomplete diagnostic data rather than guessing resource state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...diagnostics,
          authorization: { status: "verified" },
        }),
      }),
    );

    await expect(getWorkspaceSetupDiagnostics()).rejects.toThrow(
      "invalid setup diagnostics",
    );
  });

  it("surfaces the sanitized server problem detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Open VDAB through Databricks." }),
      }),
    );

    await expect(getWorkspaceSetupDiagnostics()).rejects.toThrow(
      "Open VDAB through Databricks.",
    );
  });
});
