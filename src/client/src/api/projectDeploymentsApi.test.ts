import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getProjectDeploymentHistory,
  getProjectDeploymentReadiness,
  getWorkspaceAppDeploymentTarget,
  retryProjectDeployment,
  startProjectDeployment,
} from "./projectDeploymentsApi";

describe("project deployment API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads history and readiness through same-origin project routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ childApp: null, items: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          userApiScopes: ["sql"],
          appResources: [],
          blockers: [],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const history = await getProjectDeploymentHistory("project/1");
    const readiness = await getProjectDeploymentReadiness("project/1");

    expect(history.childApp).toBeNull();
    expect(history.items).toEqual([]);
    expect(readiness.userApiScopes).toEqual(["sql"]);
    expect(readiness.appResources).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/v1/projects/project%2F1/deployments",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/v1/projects/project%2F1/deployments/readiness",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "same-origin",
    });
  });

  it("posts the selected deployment mode and explicit overwrite confirmation", async () => {
    const summary = makeDeployment();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(summary, 201));
    vi.stubGlobal("fetch", fetchMock);

    await startProjectDeployment({
      projectId: "project-id",
      mode: "linkExisting",
      appName: "child-app",
      confirmOverwrite: true,
      secretResources: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-id/deployments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "linkExisting",
          appName: "child-app",
          confirmOverwrite: true,
          secretResources: [],
        }),
      }),
    );
  });

  it("posts secret scope and key identifiers without a secret value", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeDeployment(), 201));
    vi.stubGlobal("fetch", fetchMock);

    await startProjectDeployment({
      projectId: "project-id",
      mode: "createNew",
      appName: "child-app",
      confirmOverwrite: false,
      secretResources: [
        { name: "service-api", scope: "service-scope", key: "api-key" },
      ],
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      mode: "createNew",
      appName: "child-app",
      confirmOverwrite: false,
      secretResources: [
        { name: "service-api", scope: "service-scope", key: "api-key" },
      ],
    });
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain(
      "secret-value",
    );
  });

  it("rejects malformed child App resource requirements", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          userApiScopes: [],
          appResources: [
            {
              name: "postgres",
              description: "Lakebase",
              postgres: {
                database: "other-workspace",
                permission: "CAN_CONNECT_AND_CREATE",
              },
            },
          ],
          blockers: [],
        }),
      ),
    );

    await expect(getProjectDeploymentReadiness("project-id")).rejects.toThrow(
      "invalid readiness details",
    );
  });

  it("accepts deterministic resource keys for multiple databases", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          userApiScopes: ["postgres"],
          appResources: [
            {
              name: "vdab-pg-0123456789abcdef",
              description: "Autoscaling database one",
              postgres: {
                database:
                  "projects/project-one/branches/branch-one/databases/database-one",
                permission: "CAN_CONNECT_AND_CREATE",
              },
            },
            {
              name: "vdab-db-fedcba9876543210",
              description: "Provisioned database two",
              database: {
                instance_name: "existing-instance",
                database_name: "databricks_postgres",
                permission: "CAN_CONNECT_AND_CREATE",
              },
            },
            {
              name: "vdab-wh-0123456789abcdef",
              description: "VDAB default SQL warehouse",
              sql_warehouse: { id: "warehouse-123", permission: "CAN_USE" },
            },
          ],
          blockers: [],
        }),
      ),
    );

    const readiness = await getProjectDeploymentReadiness("project-id");

    expect(readiness.appResources.map((resource) => resource.name)).toEqual([
      "vdab-pg-0123456789abcdef",
      "vdab-db-fedcba9876543210",
      "vdab-wh-0123456789abcdef",
    ]);
  });

  it("loads safe app target details and posts retry confirmation", async () => {
    const targetDetails = {
      appId: "app-id",
      name: "child-app",
      description: null,
      spaceName: null,
      effectiveUserApiScopes: null,
      appState: "STOPPED",
      computeState: "STOPPED",
      appUrl: null,
      activeDeploymentId: null,
      sourceCodePath: null,
      usesGitSource: false,
      userApiScopes: ["sql"],
      appResources: [],
      secretResources: [
        {
          name: "api-key",
          description: "API key",
          secret: {
            scope: "service-scope",
            key: "api-key",
            permission: "READ",
          },
        },
      ],
      unsupportedResourceCount: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(targetDetails))
      .mockResolvedValueOnce(jsonResponse(makeDeployment()));
    vi.stubGlobal("fetch", fetchMock);

    const target = await getWorkspaceAppDeploymentTarget("child app");
    expect(target?.name).toBe("child-app");
    expect(target?.secretResources[0]?.secret.key).toBe("api-key");
    await retryProjectDeployment({
      projectId: "project-id",
      deploymentId: "deployment-id",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/v1/workspace/apps/child%20app/deployment-target",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ confirmOverwrite: true }),
    });
  });

  it("rejects control characters and secret values in target resource metadata", async () => {
    const targetDetails = {
      appId: "app-id",
      name: "child-app",
      description: null,
      spaceName: null,
      effectiveUserApiScopes: null,
      appState: "STOPPED",
      computeState: "STOPPED",
      appUrl: null,
      activeDeploymentId: null,
      sourceCodePath: null,
      usesGitSource: false,
      userApiScopes: [],
    };

    const secretBindings = [
      { scope: "service\u0000scope", key: "api-key", permission: "READ" },
      {
        scope: "service-scope",
        key: "api-key",
        permission: "READ",
        value: "synthetic-secret",
      },
    ];
    for (const secret of secretBindings) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({
            ...targetDetails,
            secretResources: [
              { name: "api-key", description: "API key", secret },
            ],
          }),
        ),
      );

      await expect(
        getWorkspaceAppDeploymentTarget("child-app"),
      ).rejects.toThrow("invalid child App details");
    }
  });

  it("rejects malformed deployment history rather than trusting response types", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ childApp: null, items: [{ id: 7 }] }),
        ),
    );

    await expect(getProjectDeploymentHistory("project-id")).rejects.toThrow(
      "invalid deployment record",
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeDeployment() {
  return {
    id: "deployment-id",
    projectId: "project-id",
    appName: "child-app",
    mode: "createNew",
    sourceVersion: 1,
    status: "succeeded",
    deploymentId: "dbx-deployment-id",
    sourceCodePath: "/Workspace/Users/user/.vdab/deployments/source",
    failureCode: null,
    attemptOf: null,
    createdAt: "2026-10-21T00:00:00.000Z",
    completedAt: "2026-10-21T00:01:00.000Z",
  };
}
