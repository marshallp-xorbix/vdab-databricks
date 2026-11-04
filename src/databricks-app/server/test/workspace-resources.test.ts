import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { createWorkspaceResourcesClient } from "../src/workspace-resources-client.ts";

const WORKSPACE_HOST = "https://dbc-example.cloud.databricks.com";
const FORWARDED_TOKEN = "caller-token-never-return-this";


test("WorkspaceResourcesClient_PaginatesVisibleCatalogs_WithForwardedUserToken", async () => {
  const requestedUrls: string[] = [];
  const authorizationHeaders: string[] = [];
  const redirectModes: Array<RequestRedirect | undefined> = [];
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (input, init) => {
      requestedUrls.push(input.toString());
      authorizationHeaders.push(
        new Headers(init?.headers).get("authorization") ?? "",
      );
      redirectModes.push(init?.redirect);
      return requestedUrls.length === 1
        ? Response.json({ catalogs: [], next_page_token: "next" })
        : Response.json({
            catalogs: [{ name: "analytics" }, { name: "main" }],
          });
    },
  );

  const resources = await client.listCatalogs(createCaller());

  assert.deepEqual(resources, [{ name: "analytics" }, { name: "main" }]);
  assert.equal(new URL(requestedUrls[0] ?? "").origin, WORKSPACE_HOST);
  assert.equal(
    new URL(requestedUrls[0] ?? "").pathname,
    "/api/2.1/unity-catalog/catalogs",
  );
  assert.equal(
    new URL(requestedUrls[0] ?? "").searchParams.get("max_results"),
    "1000",
  );
  assert.equal(
    new URL(requestedUrls[1] ?? "").searchParams.get("page_token"),
    "next",
  );
  assert.deepEqual(authorizationHeaders, [
    `Bearer ${FORWARDED_TOKEN}`,
    `Bearer ${FORWARDED_TOKEN}`,
  ]);
  assert.deepEqual(redirectModes, ["error", "error"]);
  assert.doesNotMatch(JSON.stringify(resources), /caller-token/);
});

test("WorkspaceResourcesClient_EncodesSelectedSchemaQuery_AndSortsVolumes", async () => {
  let requestedUrl = "";
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (input) => {
      requestedUrl = input.toString();
      return Response.json({
        volumes: [{ name: "z-volume" }, { name: "a-volume" }],
      });
    },
  );

  const resources = await client.listVolumes(
    createCaller(),
    "space catalog",
    "stage 1",
  );
  const query = new URL(requestedUrl).searchParams;

  assert.equal(query.get("catalog_name"), "space catalog");
  assert.equal(query.get("schema_name"), "stage 1");
  assert.deepEqual(resources, [{ name: "a-volume" }, { name: "z-volume" }]);
});

test("WorkspaceResourcesClient_PaginatesGenieSpaces_WithViewerTokenAndSafeSummaries", async () => {
  const requestedUrls: string[] = [];
  const authorizationHeaders: string[] = [];
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (input, init) => {
      requestedUrls.push(input.toString());
      authorizationHeaders.push(
        new Headers(init?.headers).get("authorization") ?? "",
      );
      return requestedUrls.length === 1
        ? Response.json({
            spaces: [
              { space_id: "0123456789abcdef0123456789abcdef", title: "Zebra" },
            ],
            next_page_token: "next-genie-page",
          })
        : Response.json({
            spaces: [
              { space_id: "abcdef0123456789abcdef0123456789", title: "Alpha" },
            ],
          });
    },
  );

  const spaces = await client.listGenieSpaces(createCaller());

  assert.deepEqual(spaces, [
    { spaceId: "abcdef0123456789abcdef0123456789", title: "Alpha" },
    { spaceId: "0123456789abcdef0123456789abcdef", title: "Zebra" },
  ]);
  assert.equal(new URL(requestedUrls[0] ?? "").origin, WORKSPACE_HOST);
  assert.equal(
    new URL(requestedUrls[0] ?? "").pathname,
    "/api/2.0/genie/spaces",
  );
  assert.equal(
    new URL(requestedUrls[0] ?? "").searchParams.get("page_size"),
    "100",
  );
  assert.equal(
    new URL(requestedUrls[1] ?? "").searchParams.get("page_token"),
    "next-genie-page",
  );
  assert.deepEqual(authorizationHeaders, [
    `Bearer ${FORWARDED_TOKEN}`,
    `Bearer ${FORWARDED_TOKEN}`,
  ]);
  assert.doesNotMatch(JSON.stringify(spaces), /caller-token/);
});

test("WorkspaceResourcesClient_ListsCurrentServingEndpointsWithCallerTokenAndStableSummaries", async () => {
  let requestedUrl = "";
  let authorizationHeader = "";
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (input, init) => {
      requestedUrl = input.toString();
      authorizationHeader =
        new Headers(init?.headers).get("authorization") ?? "";
      return Response.json({
        endpoints: [
          {
            name: "z-endpoint",
            state: { ready: "NOT_READY" },
            permission_level: "CAN_VIEW",
          },
          {
            name: "a-endpoint",
            state: { ready: "READY" },
            permission_level: "CAN_QUERY",
          },
          {
            name: "a-endpoint",
            state: { ready: "READY" },
            permission_level: "CAN_QUERY",
          },
          { name: "unknown-readiness" },
        ],
      });
    },
  );

  const endpoints = await client.listServingEndpoints(createCaller());

  assert.equal(new URL(requestedUrl).origin, WORKSPACE_HOST);
  assert.equal(new URL(requestedUrl).pathname, "/api/2.0/serving-endpoints");
  assert.equal(new URL(requestedUrl).search, "");
  assert.equal(authorizationHeader, `Bearer ${FORWARDED_TOKEN}`);
  assert.deepEqual(endpoints, [
    { name: "a-endpoint", readiness: "ready", permissionLevel: "CAN_QUERY" },
    { name: "unknown-readiness", readiness: "unknown", permissionLevel: null },
    { name: "z-endpoint", readiness: "not-ready", permissionLevel: "CAN_VIEW" },
  ]);
  assert.doesNotMatch(JSON.stringify(endpoints), /caller-token/);
});

test("WorkspaceResourcesClient_ReturnsAnAuthorizedEmptyServingEndpointList", async () => {
  let callCount = 0;
  const client = createWorkspaceResourcesClient(WORKSPACE_HOST, async () => {
    callCount += 1;
    return Response.json({ endpoints: [] });
  });

  assert.deepEqual(await client.listServingEndpoints(createCaller()), []);
  assert.equal(callCount, 1);
});

test("WorkspaceResourcesClient_PaginatesTables_AndReturnsValidatedColumnMetadata", async () => {
  const requestedUrls: string[] = [];
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (input) => {
      requestedUrls.push(input.toString());
      return requestedUrls.length === 1
        ? Response.json({ tables: [], next_page_token: "table-page-2" })
        : Response.json({
            tables: [
              {
                name: "sales",
                data_source_format: "DELTA",
                columns: [
                  {
                    name: "amount",
                    type_name: "DECIMAL",
                    type_text: "DECIMAL(12,2)",
                  },
                  {
                    name: "customer name",
                    type_name: "STRING",
                    type_text: "STRING",
                  },
                ],
              },
              { name: "customers", columns: [] },
            ],
          });
    },
  );

  const tables = await client.listTables(createCaller(), "main", "default");
  const firstQuery = new URL(requestedUrls[0] ?? "").searchParams;
  const secondQuery = new URL(requestedUrls[1] ?? "").searchParams;

  assert.deepEqual(tables, [
    {
      name: "customers",
      dataSourceFormat: null,
      columns: [],
    },
    {
      name: "sales",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "amount", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "customer name", type: "STRING", dataType: "STRING" },
      ],
    },
  ]);
  assert.equal(firstQuery.get("catalog_name"), "main");
  assert.equal(firstQuery.get("schema_name"), "default");
  assert.equal(firstQuery.get("max_results"), "50");
  assert.equal(secondQuery.get("page_token"), "table-page-2");
  assert.doesNotMatch(JSON.stringify(tables), /caller-token/);
});

test("WorkspaceResourcesClient_PaginatesBoundedTableSummaries_WithCallerTokenAndPinnedHost", async () => {
  const requested: Array<{
    url: URL;
    authorization: string;
    signal: AbortSignal | null;
  }> = [];
  const controller = new AbortController();
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (input, init) => {
      requested.push({
        url: new URL(input.toString()),
        authorization: new Headers(init?.headers).get("authorization") ?? "",
        signal: init?.signal ?? null,
      });
      return requested.length === 1
        ? Response.json({
            tables: [{ full_name: "main.default.zebra" }],
            next_page_token: "summary-page-2",
          })
        : Response.json({
            tables: [{ full_name: "main.default.alpha" }],
          });
    },
  );

  const result = await client.listTableSummaries(
    createCaller(),
    "main",
    20,
    controller.signal,
  );

  assert.deepEqual(result, {
    items: [
      { fullName: "main.default.alpha" },
      { fullName: "main.default.zebra" },
    ],
    hasMore: false,
  });
  assert.equal(requested[0]?.url.origin, WORKSPACE_HOST);
  assert.equal(
    requested[0]?.url.pathname,
    "/api/2.1/unity-catalog/table-summaries",
  );
  assert.equal(requested[0]?.url.searchParams.get("catalog_name"), "main");
  assert.equal(requested[0]?.url.searchParams.get("max_results"), "20");
  assert.equal(
    requested[1]?.url.searchParams.get("page_token"),
    "summary-page-2",
  );
  assert.ok(
    requested.every(
      (call) => call.authorization === `Bearer ${FORWARDED_TOKEN}`,
    ),
  );
  assert.ok(requested.every((call) => call.signal !== null));
  assert.doesNotMatch(JSON.stringify(result), /caller-token|dbc-example/);
});

function createCaller(
  accessToken: string | null = FORWARDED_TOKEN,
): CallerIdentity {
  return {
    userId: "databricks-user-17",
    preferredUsername: "pat@example.com",
    email: "pat@example.com",
    workspaceId: "test-workspace",
    authenticationMode: "databricks",
    isInstallationAdmin: false,
    databricksAccessToken: accessToken,
  };
}
