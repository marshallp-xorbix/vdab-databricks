import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { createWorkspaceSetupDiagnosticsClient } from "../src/workspace-setup-diagnostics-client.ts";
import type { WorkspaceSetupDiagnosticsProvider } from "../src/workspace-setup-diagnostics-service.ts";
import { WorkspaceSetupDiagnosticsService } from "../src/workspace-setup-diagnostics-service.ts";
import { createIdentityResolver } from "../src/identity.ts";
import {
  createAppHarness,
  FORWARDED_TOKEN,
  WORKSPACE_HOST,
} from "./http-app-test-support.ts";

const USER_ID = "diagnostics-user";

function makeCaller(overrides: Partial<CallerIdentity> = {}): CallerIdentity {
  return {
    userId: USER_ID,
    preferredUsername: "diagnostics@example.com",
    email: "diagnostics@example.com",
    workspaceId: "test-workspace",
    authenticationMode: "databricks",
    isInstallationAdmin: false,
    databricksAccessToken: FORWARDED_TOKEN,
    ...overrides,
  };
}

test("WorkspaceSetupDiagnosticsClient_ReadsRequestedEffectiveAndConsentedScopesAsCaller", async () => {
  const requests: Array<{ url: URL; init: RequestInit | undefined }> = [];
  const client = createWorkspaceSetupDiagnosticsClient(
    WORKSPACE_HOST,
    "vdab-builder",
    async (input, init) => {
      requests.push({ url: new URL(input.toString()), init });
      return requests.length === 1
        ? Response.json({
            oauth2_app_client_id: "oauth-client-id",
            user_api_scopes: ["apps", "sql", "genie"],
            effective_user_api_scopes: ["apps", "sql"],
          })
        : Response.json({ scopes: ["apps", "sql"] });
    },
  );

  const result = await client.getAuthorizationDiagnostics(makeCaller());

  assert.deepEqual(result, {
    status: "verified",
    requestedScopes: ["apps", "sql", "genie"],
    effectiveScopes: ["apps", "sql"],
    consentedScopes: ["apps", "sql"],
    missingScopes: [],
    message:
      "The current user has consented to the effective scopes returned by Databricks. Resource permissions are still checked when each feature runs.",
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.url.origin, WORKSPACE_HOST);
  assert.equal(requests[0]?.url.pathname, "/api/2.0/apps/vdab-builder");
  assert.equal(
    requests[1]?.url.pathname,
    "/api/2.0/oauth-app-integrations/oauth-client-id/user-consent/me",
  );
  for (const request of requests) {
    assert.equal(request.init?.method, "GET");
    assert.equal(request.init?.redirect, "error");
    assert.equal(
      new Headers(request.init?.headers).get("Authorization"),
      `Bearer ${FORWARDED_TOKEN}`,
    );
    assert.equal(request.init?.signal instanceof AbortSignal, true);
  }
  assert.doesNotMatch(JSON.stringify(result), new RegExp(FORWARDED_TOKEN));
});

test("WorkspaceSetupDiagnosticsClient_ReportsMissingConsentWithoutExposingUpstreamBody", async () => {
  let callNumber = 0;
  const client = createWorkspaceSetupDiagnosticsClient(
    WORKSPACE_HOST,
    "vdab-builder",
    async () => {
      callNumber += 1;
      return callNumber === 1
        ? Response.json({
            oauth2_app_client_id: "oauth-client-id",
            user_api_scopes: ["apps", "sql"],
            effective_user_api_scopes: ["apps", "sql"],
          })
        : Response.json({ scope: "apps" });
    },
  );

  const result = await client.getAuthorizationDiagnostics(makeCaller());

  assert.equal(result.status, "missing-scopes");
  assert.deepEqual(result.missingScopes, ["sql"]);
  assert.match(result.message, /Grant consent in Databricks/);
});

test("WorkspaceSetupDiagnosticsClient_FailsClosedWhenAppsScopeIsDenied", async () => {
  let callCount = 0;
  const client = createWorkspaceSetupDiagnosticsClient(
    WORKSPACE_HOST,
    "vdab-builder",
    async () => {
      callCount += 1;
      return new Response(JSON.stringify({ error: "raw workspace error" }), {
        status: 403,
      });
    },
  );

  const result = await client.getAuthorizationDiagnostics(makeCaller());

  assert.equal(result.status, "unavailable");
  assert.equal(callCount, 1);
  assert.match(result.message, /configured scopes/);
  assert.doesNotMatch(result.message, /raw workspace error/);
});

test("WorkspaceSetupDiagnosticsClient_RejectsOversizedWorkspaceMetadata", async () => {
  let callCount = 0;
  const client = createWorkspaceSetupDiagnosticsClient(
    WORKSPACE_HOST,
    "vdab-builder",
    async () => {
      callCount += 1;
      return new Response(
        JSON.stringify({
          oauth2_app_client_id: "oauth-client-id",
          user_api_scopes: ["apps"],
          effective_user_api_scopes: ["apps"],
          description: "x".repeat(140_000),
        }),
      );
    },
  );

  const result = await client.getAuthorizationDiagnostics(makeCaller());

  assert.equal(result.status, "unavailable");
  assert.equal(callCount, 1);
  assert.match(result.message, /authorization configuration could not be read/);
});

test("WorkspaceSetupDiagnosticsClient_DoesNotCallWorkspaceWithoutCallerToken", async () => {
  let callCount = 0;
  const client = createWorkspaceSetupDiagnosticsClient(
    WORKSPACE_HOST,
    "vdab-builder",
    async () => {
      callCount += 1;
      return Response.json({});
    },
  );

  const result = await client.getAuthorizationDiagnostics(
    makeCaller({ databricksAccessToken: null }),
  );

  assert.equal(result.status, "unavailable");
  assert.equal(callCount, 0);
});

test("WorkspaceSetupDiagnosticsClient_RejectsUntrustedWorkspaceHost", () => {
  assert.throws(
    () =>
      createWorkspaceSetupDiagnosticsClient(
        "http://attacker.example",
        "vdab-builder",
        fetch,
      ),
    /HTTPS workspace origin/,
  );
});

test("WorkspaceSetupDiagnosticsService_ReportsOnlyLakebaseFieldPresence", async () => {
  const service = new WorkspaceSetupDiagnosticsService(
    {
      getAuthorizationDiagnostics: async () => ({
        status: "verified",
        requestedScopes: ["apps"],
        effectiveScopes: ["apps"],
        consentedScopes: ["apps"],
        missingScopes: [],
        message: "verified",
      }),
    },
    {
      LAKEBASE_ENDPOINT:
        "projects/secret-project/branches/main/endpoints/secret-endpoint",
      PGHOST: "private.example",
      PGPORT: "5432",
      PGDATABASE: "private_database",
      PGUSER: "private_user",
      PGSSLMODE: "verify-full",
      DATABRICKS_SQL_WAREHOUSE_ID: "warehouse-secret-id",
    },
  );

  const result = await service.getDiagnostics(makeCaller());

  assert.equal(result.lakebase.status, "configured");
  assert.equal(result.defaultSqlWarehouse.status, "configured");
  assert.doesNotMatch(JSON.stringify(result), /warehouse-secret-id/);
  assert.equal(result.lakebase.configuredFields.length, 6);
  assert.deepEqual(result.lakebase.missingFields, []);
  assert.doesNotMatch(
    JSON.stringify(result),
    /secret-project|private\.example|private_database|private_user/,
  );
  assert.match(
    result.lakebase.message,
    /does not test grants, connectivity, or database durability/,
  );
});

test("WorkspaceSetupDiagnosticsService_IdentifiesPartialAndLocalTestConfiguration", async () => {
  let authorizationCallCount = 0;
  const service = new WorkspaceSetupDiagnosticsService(
    {
      getAuthorizationDiagnostics: async () => {
        authorizationCallCount += 1;
        return {
          status: "verified",
          requestedScopes: [],
          effectiveScopes: [],
          consentedScopes: [],
          missingScopes: [],
          message: "verified",
        };
      },
    },
    {
      LAKEBASE_ENDPOINT: "projects/p/branches/b/endpoints/e",
      PGHOST: "db.example",
    },
  );

  const productionResult = await service.getDiagnostics(makeCaller());
  const localResult = await service.getDiagnostics(
    makeCaller({
      authenticationMode: "local-test",
      databricksAccessToken: null,
    }),
  );

  assert.equal(productionResult.lakebase.status, "incomplete");
  assert.equal(productionResult.defaultSqlWarehouse.status, "missing");
  assert.ok(productionResult.lakebase.missingFields.includes("PGDATABASE"));
  assert.equal(localResult.lakebase.status, "local-test");
  assert.equal(localResult.authorization.status, "local-test");
  assert.equal(localResult.defaultSqlWarehouse.status, "local-test");
  assert.equal(authorizationCallCount, 1);
});

test("WorkspaceSetupDiagnosticsService_ReportsInvalidDefaultWarehouseWithoutReturningIt", async () => {
  const service = new WorkspaceSetupDiagnosticsService(
    {
      getAuthorizationDiagnostics: async () => ({
        status: "verified",
        requestedScopes: [],
        effectiveScopes: [],
        consentedScopes: [],
        missingScopes: [],
        message: "verified",
      }),
    },
    { DATABRICKS_SQL_WAREHOUSE_ID: "https://untrusted-workspace.example" },
  );

  const result = await service.getDiagnostics(makeCaller());

  assert.equal(result.defaultSqlWarehouse.status, "invalid");
  assert.doesNotMatch(JSON.stringify(result), /untrusted-workspace/);
});

test("HttpApp_WorkspaceSetupDiagnosticsRequiresTrustedCallerAndReturnsSafeResult", async () => {
  let receivedUserId: string | null = null;
  const appHarness = await createAppHarness({
    identityResolver: createIdentityResolver({
      authenticationMode: "databricks",
      nodeEnvironment: "test",
      localUserId: undefined,
      workspaceHost: WORKSPACE_HOST,
      workspaceId: "test-workspace",
    }),
    workspaceSetupDiagnosticsService: {
      getDiagnostics: async (caller) => {
        receivedUserId = caller.userId;
        return {
          lakebase: {
            status: "configured",
            configuredFields: ["PGHOST", "PGDATABASE"],
            missingFields: [],
            message: "Configuration present.",
          },
          defaultSqlWarehouse: {
            status: "configured",
            message: "Workspace SQL warehouse identifier is present.",
          },
          authorization: {
            status: "verified",
            requestedScopes: ["apps"],
            effectiveScopes: ["apps"],
            consentedScopes: ["apps"],
            missingScopes: [],
            message: "Consent present.",
          },
        };
      },
    } satisfies WorkspaceSetupDiagnosticsProvider,
  });

  try {
    const response = await fetch(
      `${appHarness.baseUrl}/api/v1/setup/diagnostics`,
      {
        headers: {
          "x-forwarded-access-token": FORWARDED_TOKEN,
          "x-forwarded-user": USER_ID,
        },
      },
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(receivedUserId, USER_ID);
    assert.match(body, /"status":"verified"/);
    assert.doesNotMatch(body, new RegExp(FORWARDED_TOKEN));
  } finally {
    await appHarness.dispose();
  }
});
