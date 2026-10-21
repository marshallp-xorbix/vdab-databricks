import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer } from "node:net";
import { delimiter, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

const packageDirectory = resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "vdab-postgres-test-"));
const dataDirectory = join(temporaryRoot, "data");
const logFile = join(temporaryRoot, "postgres.log");
const port = await getAvailablePort();
const initdb = await findExecutable("initdb");
const pgCtl = await findExecutable("pg_ctl");
let serverStarted = false;

try {
  await run(initdb, [
    "-D",
    dataDirectory,
    "--auth-local=trust",
    "--auth-host=trust",
    "--username=vdab_test",
    "--encoding=UTF8",
    "--no-sync",
  ]);
  await run(pgCtl, [
    "-D",
    dataDirectory,
    "-o",
    `-h 127.0.0.1 -p ${port} -c listen_addresses=127.0.0.1`,
    "-l",
    logFile,
    "-w",
    "start",
  ]);
  serverStarted = true;
  await run(
    process.execPath,
    [
      "--experimental-strip-types",
      "--test",
      "server/test/postgres-migrations.integration.test.ts",
    ],
    {
      cwd: packageDirectory,
      env: {
        ...process.env,
        VDAB_TEST_DATABASE_URL: `postgresql://vdab_test@127.0.0.1:${port}/postgres`,
      },
    },
  );
  if (process.env.VDAB_PYTHON_EXECUTABLE !== undefined) {
    await run(
      process.execPath,
      [
        "--experimental-strip-types",
        "scripts/test-generated-lakebase-postgres.ts",
      ],
      {
        cwd: packageDirectory,
        env: {
          ...process.env,
          VDAB_TEST_DATABASE_URL:
            "postgresql://vdab_test@127.0.0.1:" + String(port) + "/postgres",
        },
      },
    );
  } else {
    process.stdout.write(
      "Skipped generated Lakebase PostgreSQL integration; set VDAB_PYTHON_EXECUTABLE to a Python environment containing asyncpg==0.32.0.\n",
    );
  }
} finally {
  if (serverStarted) {
    await run(pgCtl, ["-D", dataDirectory, "-m", "immediate", "-w", "stop"]);
  }

  const resolvedTemporaryRoot = resolve(temporaryRoot);
  const resolvedSystemTemp = resolve(tmpdir());
  assert.ok(
    resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${sep}`),
    "Refusing to remove a path outside the system temporary directory.",
  );
  await rm(resolvedTemporaryRoot, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
}

async function findExecutable(name: string): Promise<string> {
  const executableNames = process.platform === "win32" ? [`${name}.exe`, name] : [name];
  const pathEntries = (process.env.PATH ?? "").split(delimiter);

  for (const pathEntry of pathEntries) {
    for (const executableName of executableNames) {
      const candidate = join(pathEntry, executableName);

      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        continue;
      }
    }
  }

  throw new Error(`PostgreSQL executable ${name} is missing from PATH.`);
}

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
      } else {
        resolveClose();
      }
    });
  });
  return address.port;
}

async function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) {
        process.stdout.write(output);
        resolveRun();
      } else {
        rejectRun(new Error(`${command} exited with ${code ?? "no code"}.\n${output}`));
      }
    });
  });
}
