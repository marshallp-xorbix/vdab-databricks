import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import {
  createWorkspaceLakebaseResourcesClient,
  type LakebasePostgresConnectionFactory,
} from "../src/workspace-lakebase-resources-client.ts";

const WORKSPACE_HOST = "https://dbc-example.cloud.databricks.com";
const CALLER_TOKEN = "forwarded-user-token-never-return-this";

test("WorkspaceLakebaseClient_PaginatesProjectsWithCallerTokenAndSafeLabels", async () => {
  const urls: string[] = [];
  const authorization: string[] = [];
  const client = createWorkspaceLakebaseResourcesClient(WORKSPACE_HOST, async (input, init) => {
    urls.push(input.toString());
    authorization.push(new Headers(init?.headers).get("authorization") ?? "");
    return urls.length === 1
      ? Response.json({ projects: [{ project_id: "lakebase-a", status: { display_name: "Lakebase A" } }], next_page_token: "next" })
      : Response.json({ projects: [{ project_id: "lakebase-b", spec: { display_name: "Lakebase B" } }] });
  });

  const projects = await client.listProjects(createCaller());

  assert.deepEqual(projects, [
    { projectId: "lakebase-a", displayName: "Lakebase A" },
    { projectId: "lakebase-b", displayName: "Lakebase B" },
  ]);
  assert.equal(new URL(urls[0] ?? "").origin, WORKSPACE_HOST);
  assert.equal(new URL(urls[0] ?? "").pathname, "/api/2.0/postgres/projects");
  assert.equal(new URL(urls[0] ?? "").searchParams.get("page_size"), "100");
  assert.equal(new URL(urls[1] ?? "").searchParams.get("page_token"), "next");
  assert.deepEqual(authorization, [`Bearer ${CALLER_TOKEN}`, `Bearer ${CALLER_TOKEN}`]);
  assert.doesNotMatch(JSON.stringify(projects), /forwarded-user-token/);
});

test("WorkspaceLakebaseClient_RequiresCallerTokenBeforeRequestingResources", async () => {
  let callCount = 0;
  const client = createWorkspaceLakebaseResourcesClient(WORKSPACE_HOST, async () => {
    callCount += 1;
    return Response.json({ projects: [] });
  });

  await assert.rejects(
    () => client.listProjects(createCaller(null)),
    { code: "databricks_session_required", status: 401 },
  );
  assert.equal(callCount, 0);
});

test("WorkspaceLakebaseClient_HandlesEmptyResourceLists", async () => {
  const client = createWorkspaceLakebaseResourcesClient(
    WORKSPACE_HOST,
    async () => Response.json({ projects: [] }),
  );

  assert.deepEqual(await client.listProjects(createCaller()), []);
});

test("WorkspaceLakebaseClient_PropagatesCallerCancellation", async () => {
  const controller = new AbortController();
  const client = createWorkspaceLakebaseResourcesClient(WORKSPACE_HOST, async (_input, init) => {
    assert.ok(init?.signal);
    controller.abort();
    throw controller.signal.reason;
  });

  await assert.rejects(client.listProjects(createCaller(), controller.signal));
});

test("WorkspaceLakebaseClient_ListsBranchEndpointAndDatabaseSummaries", async () => {
  const urls: string[] = [];
  const client = createWorkspaceLakebaseResourcesClient(WORKSPACE_HOST, async (input) => {
    const url = readUrl(input);
    urls.push(url.toString());
    if (url.pathname.endsWith("/branches")) {
      return Response.json({ branches: [{ branch_id: "production", status: { default: true, current_state: "READY" } }] });
    }
    if (url.pathname.endsWith("/endpoints")) {
      return Response.json({ endpoints: [{ endpoint_id: "primary", status: { endpoint_type: "ENDPOINT_TYPE_READ_WRITE", current_state: "ACTIVE" } }] });
    }
    return Response.json({ databases: [{ database_id: "db-main", status: { postgres_database: "databricks_postgres" } }] });
  });

  assert.deepEqual(await client.listBranches(createCaller(), "my project"), [
    { branchId: "production", isDefault: true, state: "ready" },
  ]);
  assert.deepEqual(await client.listEndpoints(createCaller(), "project", "production"), [
    { endpointId: "primary", endpointType: "read-write", state: "active" },
  ]);
  assert.deepEqual(await client.listDatabases(createCaller(), "project", "production"), [
    { databaseId: "db-main", databaseName: "databricks_postgres" },
  ]);
  assert.match(urls[0] ?? "", /projects\/my%20project\/branches/);
  assert.match(urls[1] ?? "", /projects\/project\/branches\/production\/endpoints/);
  assert.match(urls[2] ?? "", /projects\/project\/branches\/production\/databases/);
});

test("WorkspaceLakebaseClient_ListsMetadataWithShortLivedCallerCredentialAndBoundedSql", async () => {
  const urls: string[] = [];
  const authorization: string[] = [];
  const requestBodies: string[] = [];
  const queries: Array<{ statement: string; values: readonly (string | number)[] }> = [];
  let connectionOptions: { host: string; user: string; database: string; password: string } | null = null;
  const connectionFactory: LakebasePostgresConnectionFactory = (options) => {
    connectionOptions = options;
    return {
      query: async (statement, values) => {
        queries.push({ statement, values });
        return [
          { table_name: "orders", table_type: "BASE TABLE", column_name: "order_id", data_type: "integer", is_nullable: "NO" },
          { table_name: "orders", table_type: "BASE TABLE", column_name: "note", data_type: "text", is_nullable: "YES" },
          { table_name: "order_view", table_type: "VIEW", column_name: "order_id", data_type: "integer", is_nullable: "NO" },
        ];
      },
      close: async () => undefined,
    };
  };
  const client = createWorkspaceLakebaseResourcesClient(
    WORKSPACE_HOST,
    async (input, init) => {
      const url = readUrl(input);
      urls.push(url.toString());
      authorization.push(new Headers(init?.headers).get("authorization") ?? "");
      if (init?.method === "POST") {
        requestBodies.push(typeof init.body === "string" ? init.body : "");
        return Response.json({ token: "short-lived-database-oauth-token", expire_time: "2026-10-20T12:05:00Z" });
      }
      if (url.pathname.endsWith("/endpoints/primary")) {
        return Response.json({ status: { hosts: { host: "ep-abc.database.us-west-2.cloud.databricks.com" } } });
      }
      return Response.json({ databases: [{ database_id: "databricks_postgres", status: { postgres_database: "databricks_postgres" } }] });
    },
    connectionFactory,
  );

  const tables = await client.listTables(createCaller(), "project", "production", "primary", "databricks_postgres", "public");

  assert.deepEqual(tables, [
    {
      name: "order_view",
      tableType: "VIEW",
      columns: [{ name: "order_id", type: "integer", nullable: false }],
    },
    {
      name: "orders",
      tableType: "BASE TABLE",
      columns: [
        { name: "order_id", type: "integer", nullable: false },
        { name: "note", type: "text", nullable: true },
      ],
    },
  ]);
  assert.equal(new URL(urls[0] ?? "").origin, WORKSPACE_HOST);
  assert.equal(new URL(urls[0] ?? "").pathname, "/api/2.0/postgres/projects/project/branches/production/endpoints/primary");
  assert.equal(new URL(urls[1] ?? "").pathname, "/api/2.0/postgres/projects/project/branches/production/databases");
  assert.equal(new URL(urls[2] ?? "").pathname, "/api/2.0/postgres/credentials");
  assert.deepEqual(authorization, Array(3).fill(`Bearer ${CALLER_TOKEN}`));
  assert.deepEqual(JSON.parse(requestBodies[0] ?? "{}"), {
    endpoint: "projects/project/branches/production/endpoints/primary",
    ttl: "300s",
  });
  assert.deepEqual(connectionOptions, {
    host: "ep-abc.database.us-west-2.cloud.databricks.com",
    user: "builder@example.com",
    database: "databricks_postgres",
    password: "short-lived-database-oauth-token",
  });
  assert.match(queries[0]?.statement ?? "", /information_schema\.tables/);
  assert.deepEqual(queries[0]?.values, ["public", 5001]);
  assert.doesNotMatch(JSON.stringify(tables), /oauth-token|forwarded-user-token/);
});

test("WorkspaceLakebaseClient_RequiresEmailForUserCredentialAndNeverRetriesWithAppIdentity", async () => {
  let callCount = 0;
  const client = createWorkspaceLakebaseResourcesClient(WORKSPACE_HOST, async (_input, init) => {
    callCount += 1;
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${CALLER_TOKEN}`);
    return new Response("upstream secret", { status: 403 });
  });

  await assert.rejects(
    () => client.listProjects(createCaller()),
    (error: unknown) => error instanceof ApplicationError && error.status === 403 && error.code === "lakebase_access_denied" && !error.message.includes("upstream secret"),
  );
  await assert.rejects(
    () => client.listSchemas(createCaller(CALLER_TOKEN, null), "project", "production", "primary", "databricks_postgres"),
    { code: "lakebase_user_identity_unavailable", status: 403 },
  );
  assert.equal(callCount, 1);
});

test("WorkspaceLakebaseClient_AcceptsOfficialGcpRegionalLakebaseHost", async () => {
  let connectedHost = "";
  const client = createWorkspaceLakebaseResourcesClient(
    WORKSPACE_HOST,
    async (input, init) => {
      const url = readUrl(input);
      if (url.pathname.endsWith("/endpoints/primary")) {
        return Response.json({
          status: { hosts: { host: "ep-abc.database.us-central1.gcp.databricks.com" } },
        });
      }
      if (url.pathname.endsWith("/databases")) {
        return Response.json({
          databases: [{ database_id: "databricks_postgres", status: { postgres_database: "databricks_postgres" } }],
        });
      }
      assert.equal(init?.method, "POST");
      return Response.json({ token: "short-lived-database-oauth-token" });
    },
    (options) => {
      connectedHost = options.host;
      return {
        query: async () => [{ schema_name: "public" }],
        close: async () => undefined,
      };
    },
  );

  assert.deepEqual(
    await client.listSchemas(createCaller(), "project", "production", "primary", "databricks_postgres"),
    ["public"],
  );
  assert.equal(connectedHost, "ep-abc.database.us-central1.gcp.databricks.com");
});

test("WorkspaceLakebaseClient_RejectsInvalidHostAndResourceIdentifiersBeforeConnection", async () => {
  let callCount = 0;
  let connectCount = 0;
  const client = createWorkspaceLakebaseResourcesClient(
    WORKSPACE_HOST,
    async () => {
      callCount += 1;
      return Response.json({ status: { hosts: { host: "attacker.example" } } });
    },
    () => {
      connectCount += 1;
      throw new Error("No connection expected");
    },
  );

  await assert.rejects(
    () => client.listBranches(createCaller(), "../external"),
    { code: "invalid_lakebase_resource_request", status: 400 },
  );
  await assert.rejects(
    () => client.listSchemas(createCaller(), "project", "production", "primary", "databricks_postgres"),
    { code: "lakebase_invalid_response", status: 502 },
  );
  assert.equal(callCount, 1);
  assert.equal(connectCount, 0);
});

function createCaller(
  token: string | null = CALLER_TOKEN,
  email: string | null = "builder@example.com",
): CallerIdentity {
  return {
    userId: "builder-user",
    preferredUsername: email,
    email,
    workspaceId: "test-workspace",
    authenticationMode: "databricks",
    isInstallationAdmin: false,
    databricksAccessToken: token,
  };
}

function readUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return input;
  }
  if (typeof input === "string") {
    return new URL(input);
  }
  return new URL(input.url);
}
