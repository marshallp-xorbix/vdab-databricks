import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listWorkspaceLakebaseProvisionedInstances,
  listWorkspaceLakebaseProvisionedSchemas,
  listWorkspaceLakebaseProvisionedTables,
} from "./workspaceLakebaseProvisionedResourcesApi";

describe("workspaceLakebaseProvisionedResourcesApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads current-workspace instances and PostgreSQL metadata", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        items: [{ instanceName: "legacy-instance", state: "AVAILABLE" }],
        authenticationMode: "databricks",
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ name: "public" }],
        authenticationMode: "databricks",
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ name: "orders", tableType: "BASE TABLE", columns: [{ name: "order_id", type: "integer", nullable: false }] }],
        authenticationMode: "databricks",
      }));
    vi.stubGlobal("fetch", fetchMock);

    const instances = await listWorkspaceLakebaseProvisionedInstances();
    const selection = { instanceName: "legacy instance", databaseName: "databricks_postgres" } as const;
    const schemas = await listWorkspaceLakebaseProvisionedSchemas(selection);
    const tables = await listWorkspaceLakebaseProvisionedTables(selection, "public schema");

    expect(instances.items[0]?.instanceName).toBe("legacy-instance");
    expect(schemas.items).toEqual([{ name: "public" }]);
    expect(tables.items[0]?.columns[0]?.name).toBe("order_id");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspace/lakebase/provisioned/instances",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspace/lakebase/provisioned/schemas?instanceName=legacy+instance&databaseName=databricks_postgres",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/workspace/lakebase/provisioned/tables?instanceName=legacy+instance&databaseName=databricks_postgres&schemaName=public+schema",
      expect.any(Object),
    );
  });

  it("rejects malformed instance metadata before a selector renders it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      items: [{ instanceName: "../other", state: "AVAILABLE" }],
      authenticationMode: "databricks",
    })));

    await expect(listWorkspaceLakebaseProvisionedInstances())
      .rejects.toThrow("invalid Lakebase Provisioned instance");
  });

  it("rejects PostgreSQL metadata labels containing control characters", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      items: [{ name: "public\ninternal" }],
      authenticationMode: "databricks",
    })));

    await expect(
      listWorkspaceLakebaseProvisionedSchemas({
        instanceName: "instance",
        databaseName: "database",
      }),
    ).rejects.toThrow("invalid Lakebase Provisioned schema");
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
