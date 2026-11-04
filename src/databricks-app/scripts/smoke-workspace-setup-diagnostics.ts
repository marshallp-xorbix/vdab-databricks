import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";

const deploymentDirectory = resolve(import.meta.dirname, "..", ".build");
const port = await getAvailablePort();
const forwardedToken = "setup-smoke-token-must-not-be-returned-or-logged";
const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "server/src/main.ts"],
  {
    cwd: deploymentDirectory,
    env: {
      ...process.env,
      NODE_ENV: "development",
      VDAB_AUTH_MODE: "local-test",
      VDAB_LOCAL_USER_ID: "local-smoke-user",
      DATABRICKS_APP_PORT: String(port),
      DATABRICKS_HOST: "",
      DATABRICKS_WORKSPACE_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let childOutput = "";
child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
  childOutput += chunk;
});
child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
  childOutput += chunk;
});

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilReady(baseUrl, child);

  const response = await fetch(`${baseUrl}/api/v1/setup/diagnostics`, {
    headers: {
      "x-forwarded-access-token": forwardedToken,
      "x-forwarded-user": "forged-smoke-user",
    },
  });
  const body: unknown = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(isRecord(body) && isRecord(body.lakebase));
  assert.ok(isRecord(body) && isRecord(body.authorization));
  assert.equal(body.lakebase.status, "local-test");
  assert.equal(body.authorization.status, "local-test");
  assert.deepEqual(body.lakebase.configuredFields, []);
  assert.deepEqual(body.lakebase.missingFields, []);
  assert.doesNotMatch(JSON.stringify(body), /PGHOST|setup-smoke-token/);

  process.stdout.write(
    `${JSON.stringify({
      event: "app.setup-diagnostics-smoke.passed",
      checks: [
        "local-test-diagnostics",
        "no-store-caller-specific-response",
        "no-resource-values-or-token",
        "no-databricks-call-in-local-test",
      ],
    })}\n`,
  );
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const childExited = once(child, "exit");
    child.kill("SIGTERM");
    await childExited;
  }

  assert.doesNotMatch(childOutput, new RegExp(forwardedToken));
}

async function getAvailablePort(): Promise<number> {
  const probeServer = createServer();

  await new Promise<void>((resolveListen, rejectListen) => {
    probeServer.once("error", rejectListen);
    probeServer.listen(0, "127.0.0.1", resolveListen);
  });

  const address = probeServer.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;

  await new Promise<void>((resolveClose, rejectClose) => {
    probeServer.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });

  return port;
}

async function waitUntilReady(
  baseUrl: string,
  childProcess: ReturnType<typeof spawn>,
): Promise<void> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null) {
      throw new Error(
        `Packaged app exited before readiness. Output: ${childOutput}`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/health/live`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
  }

  throw new Error(`Packaged app did not become ready. Output: ${childOutput}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
