import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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
  throw new Error("Refusing to package outside the Databricks App source directory.");
}

await rm(deploymentDirectory, { recursive: true, force: true });
await mkdir(deploymentDirectory, { recursive: true });
await cp(resolve(packageDirectory, "server", "src"), resolve(deploymentDirectory, "server", "src"), {
  recursive: true,
});
await cp(resolve(runtimeDirectory, "package.json"), resolve(deploymentDirectory, "package.json"));
await cp(
  resolve(runtimeDirectory, "package-lock.json"),
  resolve(deploymentDirectory, "package-lock.json"),
);
await cp(clientBuildDirectory, resolve(deploymentDirectory, "public"), {
  recursive: true,
});
await cp(resolve(packageDirectory, "app.yaml"), resolve(deploymentDirectory, "app.yaml"));

process.stdout.write(
  `${JSON.stringify({ event: "app.packaged", directory: deploymentDirectory })}\n`,
);
