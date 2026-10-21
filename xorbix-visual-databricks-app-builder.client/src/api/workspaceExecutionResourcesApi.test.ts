import { afterEach, describe, expect, it, vi } from "vitest";
import { listWorkspaceJobs, listWorkspaceSqlWarehouses } from "./workspaceExecutionResourcesApi";

describe("workspaceExecutionResourcesApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists jobs from the installed workspace route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [{ jobId: "812", name: "Refresh customers" }],
        authenticationMode: "databricks",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await listWorkspaceJobs();

    expect(response.items).toEqual([{ jobId: "812", name: "Refresh customers" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/workspace/resources/jobs",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
  });

  it("lists SQL warehouses and validates untrusted resource shapes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [{ id: "abc-123", name: "Shared warehouse", state: "running" }],
          authenticationMode: "databricks",
        }),
      ),
    );
    const response = await listWorkspaceSqlWarehouses();
    expect(response.items[0]?.id).toBe("abc-123");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [{ jobId: "not-a-job-id", name: "bad" }],
          authenticationMode: "databricks",
        }),
      ),
    );
    await expect(listWorkspaceJobs()).rejects.toThrow("invalid Job");
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
