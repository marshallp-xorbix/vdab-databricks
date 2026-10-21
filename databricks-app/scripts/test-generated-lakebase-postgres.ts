import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  generateLakebaseComponentTestApp,
  generateLakebaseTestApp,
} from "./lakebase-test-app.ts";

const packageDirectory = resolve(import.meta.dirname, "..");
const pythonExecutable = process.env.VDAB_PYTHON_EXECUTABLE;
const databaseUrl = process.env.VDAB_TEST_DATABASE_URL;

assert.ok(pythonExecutable, "VDAB_PYTHON_EXECUTABLE must point to Python with asyncpg.");
assert.ok(databaseUrl, "VDAB_TEST_DATABASE_URL must target the disposable local database.");

const database = new URL(databaseUrl);
assert.equal(database.protocol, "postgresql:");
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.username, "vdab_test");
assert.equal(database.password, "");
assert.equal(database.pathname, "/postgres");

const port = Number(database.port);
assert.ok(Number.isInteger(port) && port >= 1 && port <= 65535);

const input = JSON.stringify({
  ...generateLakebaseTestApp(),
  componentFiles: generateLakebaseComponentTestApp().files,
  scenario: "lakebase-postgres",
  connection: {
    host: database.hostname,
    port,
    user: database.username,
    database: database.pathname.slice(1),
  },
});

const output = await runPythonHarness(pythonExecutable, input);
const result: unknown = JSON.parse(output);
assert.ok(isRecord(result));
assert.equal(result.event, "generated-workflow-smoke.passed");
assert.deepEqual(result.checks, [
  "local-postgresql-generated-workflow-read-write-and-viewer-permissions",
  "local-postgresql-lakebase-component-reads-13",
]);
process.stdout.write(`${JSON.stringify(result)}\n`);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runPythonHarness(executable: string, inputJson: string): Promise<string> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, ["scripts/smoke-generated-workflow.py"], {
      cwd: packageDirectory,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveRun(stdout);
      } else {
        rejectRun(new Error(`Generated Lakebase harness exited with ${code ?? "no code"}.\n${stderr}`));
      }
    });
    child.stdin.end(inputJson);
  });
}
