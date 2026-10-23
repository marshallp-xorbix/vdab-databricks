import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { addDefaultSqlWarehouseResourceBinding } from "./builder-app-manifest.ts";

const packageDirectory = resolve(import.meta.dirname, "..");
const deploymentDirectory = resolve(packageDirectory, ".build");
const expectedParent = resolve(packageDirectory);
const runtimeDirectory = resolve(packageDirectory, "runtime");
const clientBuildDirectory = resolve(
  packageDirectory,
  "..",
  "xorbix-visual-databricks-app-builder.client",
  "build",
  "client",
);
if (dirname(deploymentDirectory) !== expectedParent) {
  throw new Error(
    "Refusing to package outside the Databricks App source directory.",
  );
}

await rm(deploymentDirectory, { recursive: true, force: true });
await mkdir(deploymentDirectory, { recursive: true });
await cp(
  resolve(packageDirectory, "server", "src"),
  resolve(deploymentDirectory, "server", "src"),
  {
    recursive: true,
  },
);
await cp(
  resolve(runtimeDirectory, "package.json"),
  resolve(deploymentDirectory, "package.json"),
);
await cp(
  resolve(runtimeDirectory, "package-lock.json"),
  resolve(deploymentDirectory, "package-lock.json"),
);
await cp(clientBuildDirectory, resolve(deploymentDirectory, "public"), {
  recursive: true,
});
const sourceAppManifest = await readFile(
  resolve(packageDirectory, "app.yaml"),
  "utf8",
);
const packagedAppManifest = addDefaultSqlWarehouseResourceBinding(
  sourceAppManifest,
  process.env.VDAB_DEFAULT_SQL_WAREHOUSE_RESOURCE_KEY,
);
await writeFile(
  resolve(deploymentDirectory, "app.yaml"),
  packagedAppManifest,
  "utf8",
);
for (const documentName of [
  "DEPENDENCY_LICENSE_INVENTORY.md",
  "THIRD_PARTY_NOTICES.md",
]) {
  const sourcePath = resolve(packageDirectory, documentName);
  const packagePath = resolve(deploymentDirectory, documentName);
  await cp(sourcePath, packagePath);
  const [sourceContent, packagedContent] = await Promise.all([
    readFile(sourcePath),
    readFile(packagePath),
  ]);
  if (!sourceContent.equals(packagedContent)) {
    throw new Error(`${documentName} was not packaged unchanged.`);
  }
}

process.stdout.write(
  `${JSON.stringify({ event: "app.packaged", directory: deploymentDirectory })}\n`,
);
