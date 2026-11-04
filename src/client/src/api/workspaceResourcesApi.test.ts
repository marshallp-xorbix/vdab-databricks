import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listWorkspaceCatalogs,
  listWorkspaceGenieSpaces,
  listWorkspaceServingEndpoints,
  listWorkspaceSchemas,
  listWorkspaceTables,
  listWorkspaceVolumes,
} from "./workspaceResourcesApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspaceResourcesApi", () => {
  it("loads resources through same-origin routes without workspace authority", async () => {
    const fetchMock = vi.fn().mockImplementation((path: string) =>
      Response.json({
        items: path.includes("/genie-spaces")
          ? [{ spaceId: "0123456789abcdef0123456789abcdef", title: "Revenue Genie" }]
          : path.includes("/serving-endpoints")
          ? [{ name: "support-chat", readiness: "ready", permissionLevel: "CAN_QUERY" }]
          : path.includes("/tables")
          ? [{ name: "customers", dataSourceFormat: "DELTA", columns: [{ name: "id", type: "BIGINT", dataType: "LONG" }] }]
          : [{ name: "main" }],
        authenticationMode: "databricks",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    const catalogs = await listWorkspaceCatalogs(signal);
    const schemas = await listWorkspaceSchemas("catalog with spaces", signal);
    const volumes = await listWorkspaceVolumes("main", "landing", signal);
    const tables = await listWorkspaceTables("main", "sales", signal);
    const genieSpaces = await listWorkspaceGenieSpaces(signal);
    const servingEndpoints = await listWorkspaceServingEndpoints(signal);

    expect(catalogs.items[0]?.name).toBe("main");
    expect(schemas.items[0]?.name).toBe("main");
    expect(volumes.items[0]?.name).toBe("main");
    expect(tables.items[0]?.columns[0]?.type).toBe("BIGINT");
    expect(tables.items[0]?.columns[0]?.dataType).toBe("LONG");
    expect(tables.items[0]?.dataSourceFormat).toBe("DELTA");
    expect(genieSpaces.items[0]?.spaceId).toBe("0123456789abcdef0123456789abcdef");
    expect(servingEndpoints.items[0]).toMatchObject({
      name: "support-chat",
      readiness: "ready",
      permissionLevel: "CAN_QUERY",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspace/resources/catalogs",
      expect.objectContaining({ credentials: "same-origin", signal }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspace/resources/schemas?catalogName=catalog+with+spaces",
      expect.objectContaining({ credentials: "same-origin", signal }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/workspace/resources/volumes?catalogName=main&schemaName=landing",
      expect.objectContaining({ credentials: "same-origin", signal }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/v1/workspace/resources/tables?catalogName=main&schemaName=sales",
      expect.objectContaining({ credentials: "same-origin", signal }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/v1/workspace/resources/genie-spaces",
      expect.objectContaining({ credentials: "same-origin", signal }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "/api/v1/workspace/resources/serving-endpoints",
      expect.objectContaining({ credentials: "same-origin", signal }),
    );
    expect(fetchMock.mock.calls.map(([url]) => String(url)).join(" ")).not.toMatch(
      /https?:|workspaceHost|token/i,
    );
  });

  it("surfaces sanitized access failures and rejects malformed resource results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          Response.json(
            { title: "Workspace resource access is not available", detail: "Check access." },
            { status: 403 },
          ),
        )
        .mockResolvedValueOnce(Response.json({ items: [{ name: 7 }] })),
    );

    await expect(listWorkspaceCatalogs()).rejects.toThrow("Check access.");
    await expect(listWorkspaceCatalogs()).rejects.toThrow(
      "invalid resource response",
    );
  });

  it("rejects malformed table format and column type metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          Response.json({
            items: [{ name: "customers", dataSourceFormat: 7, columns: [] }],
            authenticationMode: "databricks",
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            items: [{ name: "customers", dataSourceFormat: "DELTA", columns: [{ name: "id", type: "BIGINT", dataType: 7 }] }],
            authenticationMode: "databricks",
          }),
        ),
    );

    await expect(listWorkspaceTables("main", "default")).rejects.toThrow(
      "invalid table",
    );
    await expect(listWorkspaceTables("main", "default")).rejects.toThrow(
      "invalid table column metadata",
    );
  });

  it("rejects malformed serving endpoint summaries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      items: [{ name: "external/endpoint", readiness: "ready", permissionLevel: "CAN_QUERY" }],
      authenticationMode: "databricks",
    })));

    await expect(listWorkspaceServingEndpoints()).rejects.toThrow("invalid serving endpoint");
  });

  it("rejects malformed Genie space identities and titles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(Response.json({
          items: [{ spaceId: "outside", title: "Revenue" }],
          authenticationMode: "databricks",
        }))
        .mockResolvedValueOnce(Response.json({
          items: [{ spaceId: "0123456789abcdef0123456789abcdef", title: " Revenue " }],
          authenticationMode: "databricks",
        })),
    );

    await expect(listWorkspaceGenieSpaces()).rejects.toThrow("invalid Genie space");
    await expect(listWorkspaceGenieSpaces()).rejects.toThrow("invalid Genie space");
  });
});
