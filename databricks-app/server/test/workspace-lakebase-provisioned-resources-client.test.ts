import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import {
  createWorkspaceLakebaseProvisionedResourcesClient,
  type ProvisionedPostgresConnectionFactory,
} from "../src/workspace-lakebase-provisioned-resources-client.ts";

const WORKSPACE_HOST = "https://dbc-example.cloud.databricks.com";
const CALLER_TOKEN = "forwarded-user-token-never-return-this";
const DATABASE_HOST = "ep-abc.database.us-west-2.dev.databricks.com";

test("WorkspaceLakebaseProvisionedClient_PaginatesInstancesWithoutExposingDatabaseHosts", async () => {
  const urls: string[] = [];
  const client = createWorkspaceLakebaseProvisionedResourcesClient(WORKSPACE_HOST, async (input, init) => {
    const url = readUrl(input);
    urls.push(url.toString());
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${CALLER_TOKEN}`);
    return urls.length === 1
      ? Response.json({
          database_instances: [{ name: "instance-a", state: "AVAILABLE", read_write_dns: DATABASE_HOST }],
          next_page_token: "next-page",
        })
      : Response.json({
          database_instances: [{ name: "instance-b", state: "STOPPED", read_write_dns: DATABASE_HOST }],
        });
  });

  const instances = await client.listInstances(createCaller());

  assert.deepEqual(instances, [
    { instanceName: "instance-a", state: "AVAILABLE" },
    { instanceName: "instance-b", state: "STOPPED" },
  ]);
  assert.equal(new URL(urls[0] ?? "").origin, WORKSPACE_HOST);
  assert.equal(new URL(urls[0] ?? "").pathname, "/api/2.0/database/instances");
  assert.equal(new URL(urls[0] ?? "").searchParams.get("page_size"), "100");
  assert.equal(new URL(urls[1] ?? "").searchParams.get("page_token"), "next-page");
  assert.doesNotMatch(JSON.stringify(instances), /ep-abc|forwarded-user-token/);
});

test("WorkspaceLakebaseProvisionedClient_ListsMetadataWithCallerCredentialAndParameterizedQueries", async () => {
  const urls: string[] = [];
  const authorization: string[] = [];
  const queryCalls: Array<{ statement: string; parameters: readonly (string | number)[] }> = [];
  const connectionOptions: Array<{ host: string; user: string; database: string; password: string }> = [];
  const connectionFactory: ProvisionedPostgresConnectionFactory = (options) => {
    connectionOptions.push(options);
    return {
      query: async (statement, parameters) => {
        queryCalls.push({ statement, parameters });
        return statement.includes("information_schema.schemata")
          ? [{ schema_name: "public" }]
          : [{
              table_name: "orders",
              table_type: "BASE TABLE",
              column_name: "order_id",
              data_type: "integer",
              is_nullable: "NO",
              ordinal_position: 1,
            }];
      },
      close: async () => undefined,
    };
  };
  const client = createWorkspaceLakebaseProvisionedResourcesClient(
    WORKSPACE_HOST,
    async (input, init) => {
      const url = readUrl(input);
      urls.push(url.toString());
      authorization.push(new Headers(init?.headers).get("authorization") ?? "");
      if (url.pathname.endsWith("/credentials")) {
        assert.deepEqual(JSON.parse(String(init?.body)), { instance_names: ["instance-a"] });
        return Response.json({ token: "short-lived-database-token", expiration_time: "2026-10-21T12:05:00Z" });
      }
      return Response.json({
        name: "instance-a",
        state: "AVAILABLE",
        read_write_dns: DATABASE_HOST,
      });
    },
    connectionFactory,
  );
  const caller = createCaller();

  const schemas = await client.listSchemas(caller, "instance-a", "databricks_postgres");
  const tables = await client.listTables(caller, "instance-a", "databricks_postgres", "public");

  assert.deepEqual(schemas, ["public"]);
  assert.deepEqual(tables, [{
    name: "orders",
    tableType: "BASE TABLE",
    columns: [{ name: "order_id", type: "integer", nullable: false }],
  }]);
  assert.equal(new URL(urls[0] ?? "").pathname, "/api/2.0/database/instances/instance-a");
  assert.equal(new URL(urls[1] ?? "").pathname, "/api/2.0/database/credentials");
  assert.equal(urls.length, 4);
  assert.ok(authorization.every((value) => value === `Bearer ${CALLER_TOKEN}`));
  assert.deepEqual(connectionOptions, [
    { host: DATABASE_HOST, user: "builder@example.com", database: "databricks_postgres", password: "short-lived-database-token" },
    { host: DATABASE_HOST, user: "builder@example.com", database: "databricks_postgres", password: "short-lived-database-token" },
  ]);
  assert.deepEqual(queryCalls.map(({ parameters }) => parameters), [[5001], ["public", 5001]]);
  assert.match(queryCalls[1]?.statement ?? "", /information_schema\.tables/);
  assert.doesNotMatch(JSON.stringify({ schemas, tables, urls }), /short-lived-database-token|forwarded-user-token/);
});

test("WorkspaceLakebaseProvisionedClient_RejectsInvalidHostAndIdentifiersWithoutFallback", async () => {
  let requestCount = 0;
  let connectionCount = 0;
  const client = createWorkspaceLakebaseProvisionedResourcesClient(
    WORKSPACE_HOST,
    async (_input, init) => {
      requestCount += 1;
      assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${CALLER_TOKEN}`);
      return Response.json({
        name: "instance-a",
        state: "AVAILABLE",
        read_write_dns: "attacker.example",
      });
    },
    () => {
      connectionCount += 1;
      throw new Error("Connection should not be opened for an invalid host");
    },
  );

  await assert.rejects(
    () => client.listTables(createCaller(), "instance-a", "databricks_postgres", ""),
    { status: 400, code: "invalid_lakebase_provisioned_request" },
  );
  await assert.rejects(
    () => client.listSchemas(createCaller(), "instance-a", "databricks_postgres"),
    (error: unknown) => error instanceof ApplicationError && error.status === 502 && error.code === "invalid_lakebase_provisioned_response",
  );
  assert.equal(requestCount, 1);
  assert.equal(connectionCount, 0);
});

test("WorkspaceLakebaseProvisionedClient_RequiresUserIdentityBeforeCredentialExchange", async () => {
  let requestCount = 0;
  const client = createWorkspaceLakebaseProvisionedResourcesClient(WORKSPACE_HOST, async () => {
    requestCount += 1;
    return Response.json({
      name: "instance-a",
      state: "AVAILABLE",
      read_write_dns: DATABASE_HOST,
    });
  });

  await assert.rejects(
    () => client.listSchemas(createCaller(CALLER_TOKEN, null), "instance-a", "databricks_postgres"),
    { status: 401, code: "databricks_user_identity_required" },
  );
  assert.equal(requestCount, 0);
});

function createCaller(
  databricksAccessToken: string | null = CALLER_TOKEN,
  email: string | null = "builder@example.com",
): CallerIdentity {
  return {
    userId: "builder-user",
    preferredUsername: email,
    email,
    workspaceId: "workspace-1",
    authenticationMode: "databricks",
    isInstallationAdmin: false,
    databricksAccessToken,
  };
}

function readUrl(input: string | URL | Request): URL {
  return new URL(input instanceof Request ? input.url : input.toString());
}
