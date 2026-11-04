import { afterEach, describe, expect, it, vi } from "vitest";
import { listWorkspaceApps } from "./workspaceAppsApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listWorkspaceApps", () => {
  it("requests the same-origin workspace endpoint and parses its contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        items: [
          {
            name: "sales-dashboard",
            description: "Sales metrics",
            appState: "RUNNING",
            computeState: "ACTIVE",
          },
        ],
        nextPageToken: "page/2",
        authenticationMode: "databricks",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await listWorkspaceApps("page/1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/workspace/apps?pageSize=100&pageToken=page%2F1",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      }),
    );
    expect(page).toEqual({
      items: [
        {
          name: "sales-dashboard",
          description: "Sales metrics",
          appState: "RUNNING",
          computeState: "ACTIVE",
        },
      ],
      nextPageToken: "page/2",
      authenticationMode: "databricks",
    });
  });

  it("passes the cancellation signal to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        items: [],
        nextPageToken: null,
        authenticationMode: "local-test",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await listWorkspaceApps(null, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/workspace/apps?pageSize=100",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("surfaces the server problem detail for a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { title: "Apps access is not available", detail: "Ask an admin." },
          { status: 403 },
        ),
      ),
    );

    await expect(listWorkspaceApps(null)).rejects.toThrow("Ask an admin.");
  });

  it("rejects a response that does not match the workspace apps contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items: [] })));

    await expect(listWorkspaceApps(null)).rejects.toThrow(
      "The workspace returned an invalid apps response.",
    );
  });
});
