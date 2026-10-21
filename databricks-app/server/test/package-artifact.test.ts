import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const runtimeDirectory = resolve(import.meta.dirname, "../../runtime");

test("PackageArtifact_RuntimeManifestAndLockArePinnedAndSynchronized", async () => {
  const manifest = readRecord(
    JSON.parse(
      await readFile(resolve(runtimeDirectory, "package.json"), "utf8"),
    ) as unknown,
  );
  const lock = readRecord(
    JSON.parse(
      await readFile(resolve(runtimeDirectory, "package-lock.json"), "utf8"),
    ) as unknown,
  );
  const manifestDependencies = readRecord(manifest.dependencies);
  const lockPackages = readRecord(lock.packages);
  const lockRoot = readRecord(lockPackages[""]);
  const lockDependencies = readRecord(lockRoot.dependencies);
  const postgresPackage = readRecord(lockPackages["node_modules/pg"]);

  assert.equal(manifest.name, "vdab-databricks-app-runtime");
  assert.deepEqual(manifestDependencies, { pg: "8.23.1" });
  assert.deepEqual(lockDependencies, manifestDependencies);
  assert.equal(postgresPackage.version, manifestDependencies.pg);
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lockPackages["node_modules/@types/pg"], undefined);
});

function readRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}
