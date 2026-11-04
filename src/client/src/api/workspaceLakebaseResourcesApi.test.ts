import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listWorkspaceLakebaseBranches,
  listWorkspaceLakebaseDatabases,
  listWorkspaceLakebaseEndpoints,
  listWorkspaceLakebaseProjects,
  listWorkspaceLakebaseSchemas,
  listWorkspaceLakebaseTables,
} from "./workspaceLakebaseResourcesApi";

describe("workspaceLakebaseResourcesApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads projects and branch resources from installed-workspace routes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        items: [{ projectId: "sales-project", displayName: "Sales" }],
        authenticationMode: "databricks",
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ branchId: "production", isDefault: true, state: "ready" }],
        authenticationMode: "databricks",
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ endpointId: "primary", endpointType: "read-write", state: "active" }],
        authenticationMode: "databricks",
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ databaseId: "db-main", databaseName: "databricks_postgres" }],
        authenticationMode: "databricks",
      }));
    vi.stubGlobal("fetch", fetchMock);

    const projects = await listWorkspaceLakebaseProjects();
    const branches = await listWorkspaceLakebaseBranches("sales project");
    const endpoints = await listWorkspaceLakebaseEndpoints("sales-project", "production");
    const databases = await listWorkspaceLakebaseDatabases("sales-project", "production");

    expect(projects.items[0]?.displayName).toBe("Sales");
    expect(branches.items[0]?.branchId).toBe("production");
    expect(endpoints.items[0]?.endpointType).toBe("read-write");
    expect(databases.items[0]?.databaseName).toBe("databricks_postgres");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspace/lakebase/projects",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspace/lakebase/branches?projectId=sales+project",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/workspace/lakebase/endpoints?projectId=sales-project&branchId=production",
      expect.any(Object),
    );
  });

  it("loads schemas and table columns for the selected Lakebase database", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ name: "public" }], authenticationMode: "databricks" }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ name: "orders", tableType: "BASE TABLE", columns: [{ name: "order_id", type: "integer", nullable: false }] }],
        authenticationMode: "databricks",
      }));
    vi.stubGlobal("fetch", fetchMock);
    const selection = {
      projectId: "sales-project",
      branchId: "production",
      endpointId: "primary",
      databaseName: "databricks_postgres",
    } as const;

    const schemas = await listWorkspaceLakebaseSchemas(selection);
    const tables = await listWorkspaceLakebaseTables(selection, "public schema");

    expect(schemas.items).toEqual([{ name: "public" }]);
    expect(tables.items[0]?.columns[0]?.nullable).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspace/lakebase/schemas?projectId=sales-project&branchId=production&endpointId=primary&databaseName=databricks_postgres",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspace/lakebase/tables?projectId=sales-project&branchId=production&endpointId=primary&databaseName=databricks_postgres&schemaName=public+schema",
      expect.any(Object),
    );
  });

  it("rejects malformed Lakebase resource responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      items: [{ projectId: "../other", displayName: "Bad" }],
      authenticationMode: "databricks",
    })));
    await expect(listWorkspaceLakebaseProjects()).rejects.toThrow("invalid Lakebase project");
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
