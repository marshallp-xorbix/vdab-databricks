import assert from "node:assert/strict";
import test from "node:test";
import {
  createLakebasePasswordProvider,
  MAX_LAKEBASE_CREDENTIAL_RESPONSE_BYTES,
  type LakebaseCredentialEnvironment,
} from "../src/db/lakebase-credentials.ts";

const CLIENT_SECRET = "secret-never-log-this";
const OAUTH_TOKEN = "workspace-token-never-return-this";
const DATABASE_TOKEN = "database-token-never-return-this";

test("LakebaseCredentials_ExchangesWorkspaceAndDatabaseTokens_AndCachesBoth", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: input.toString(), init: init ?? {} });

    if (input.toString().endsWith("/oidc/v1/token")) {
      return new Response(
        JSON.stringify({ access_token: OAUTH_TOKEN, expires_in: 3600 }),
        { status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        token: DATABASE_TOKEN,
        expire_time: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      { status: 200 },
    );
  };
  const passwordProvider = createLakebasePasswordProvider(
    testEnvironment(),
    fetcher,
  );

  const firstPassword = await passwordProvider();
  const secondPassword = await passwordProvider();
  const oauthCall = calls[0];
  const databaseCall = calls[1];

  assert.equal(firstPassword, DATABASE_TOKEN);
  assert.equal(secondPassword, DATABASE_TOKEN);
  assert.equal(calls.length, 2);
  assert.equal(
    oauthCall?.url,
    "https://dbc-example.cloud.databricks.com/oidc/v1/token",
  );
  assert.equal(
    databaseCall?.url,
    "https://dbc-example.cloud.databricks.com/api/2.0/postgres/credentials",
  );
  assert.equal(
    new Headers(oauthCall?.init.headers).get("authorization"),
    `Basic ${Buffer.from(`client-id:${CLIENT_SECRET}`).toString("base64")}`,
  );
  assert.equal(
    new Headers(databaseCall?.init.headers).get("authorization"),
    `Bearer ${OAUTH_TOKEN}`,
  );
  assert.equal(oauthCall?.init.redirect, "error");
  assert.equal(databaseCall?.init.redirect, "error");
  assert.deepEqual(JSON.parse(String(databaseCall?.init.body)), {
    endpoint: "projects/project-id/branches/branch-id/endpoints/endpoint-id",
  });
});

test("LakebaseCredentials_RefreshesBothExpiredTokensFiveMinutesEarly", async () => {
  let currentTime = 0;
  let requestNumber = 0;
  const fetcher: typeof fetch = async (input) => {
    requestNumber += 1;
    const tokenNumber = requestNumber;

    if (input.toString().endsWith("/oidc/v1/token")) {
      return new Response(
        JSON.stringify({
          access_token: `${OAUTH_TOKEN}-${tokenNumber}`,
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        token: `${DATABASE_TOKEN}-${tokenNumber}`,
        expire_time: new Date(currentTime + 3_600_000).toISOString(),
      }),
      { status: 200 },
    );
  };
  const passwordProvider = createLakebasePasswordProvider(
    testEnvironment(),
    fetcher,
    () => currentTime,
  );

  assert.equal(await passwordProvider(), `${DATABASE_TOKEN}-2`);
  currentTime = 3_300_000;
  assert.equal(await passwordProvider(), `${DATABASE_TOKEN}-4`);
  assert.equal(requestNumber, 4);
});

test("LakebaseCredentials_CoalescesConcurrentInitialRefreshes", async () => {
  const requestedUrls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    requestedUrls.push(input.toString());
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));

    if (input.toString().endsWith("/oidc/v1/token")) {
      return new Response(
        JSON.stringify({ access_token: OAUTH_TOKEN, expires_in: 3600 }),
        { status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        token: DATABASE_TOKEN,
        expire_time: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      { status: 200 },
    );
  };
  const passwordProvider = createLakebasePasswordProvider(
    testEnvironment(),
    fetcher,
  );

  const passwords = await Promise.all([
    passwordProvider(),
    passwordProvider(),
    passwordProvider(),
  ]);

  assert.deepEqual(passwords, [DATABASE_TOKEN, DATABASE_TOKEN, DATABASE_TOKEN]);
  assert.equal(requestedUrls.length, 2);
});

test("LakebaseCredentials_RejectsFailedExchange_WithoutExposingResponseBody", async () => {
  const fetcher: typeof fetch = async () =>
    new Response("database-token-should-not-leak", { status: 403 });
  const passwordProvider = createLakebasePasswordProvider(
    testEnvironment(),
    fetcher,
  );

  await assert.rejects(
    () => passwordProvider(),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /workspace credential/);
      assert.doesNotMatch(error.message, /database-token-should-not-leak/);
      return true;
    },
  );
});

test("LakebaseCredentials_RejectsOversizedWorkspaceCredentialResponse", async () => {
  const passwordProvider = createLakebasePasswordProvider(
    testEnvironment(),
    async () =>
      new Response("credential-response-must-not-leak", {
        status: 200,
        headers: {
          "content-length": String(MAX_LAKEBASE_CREDENTIAL_RESPONSE_BYTES + 1),
        },
      }),
  );

  await assert.rejects(
    () => passwordProvider(),
    /invalid workspace credential/,
  );
});

test("LakebaseCredentials_RejectsOversizedDatabaseCredentialResponse", async () => {
  let callCount = 0;
  const passwordProvider = createLakebasePasswordProvider(
    testEnvironment(),
    async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ access_token: OAUTH_TOKEN, expires_in: 3600 }),
          { status: 200 },
        );
      }

      return new Response("database-credential-must-not-leak", {
        status: 200,
        headers: {
          "content-length": String(MAX_LAKEBASE_CREDENTIAL_RESPONSE_BYTES + 1),
        },
      });
    },
  );

  await assert.rejects(() => passwordProvider(), /invalid Lakebase credential/);
});

test("LakebaseCredentials_RejectsUnpinnedWorkspaceAndMalformedBoundEndpoint", () => {
  assert.throws(
    () =>
      createLakebasePasswordProvider({
        ...testEnvironment(),
        workspaceHost:
          "https://dbc-example.cloud.databricks.com/other-workspace",
      }),
    /HTTPS workspace origin/,
  );
  assert.throws(
    () =>
      createLakebasePasswordProvider({
        ...testEnvironment(),
        endpoint: "https://other-workspace.example.com",
      }),
    /bound Lakebase endpoint path/,
  );
});

function testEnvironment(): LakebaseCredentialEnvironment {
  return {
    workspaceHost: "https://dbc-example.cloud.databricks.com",
    clientId: "client-id",
    clientSecret: CLIENT_SECRET,
    endpoint: "projects/project-id/branches/branch-id/endpoints/endpoint-id",
  };
}
