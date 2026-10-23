import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ASYNC_PG_LICENSE_TEXT,
  ASYNC_PG_PACKAGE_NAME,
  ASYNC_PG_PACKAGE_VERSION,
} from "../server/src/generation/asyncpg-package-notice.ts";
import {
  collectPackageLicenseInventory,
  renderPackageLicenseInventory,
  type PackageLicenseInventoryItem,
} from "./third-party-license-inventory.ts";
import {
  collectPackageLicenseNotices,
  renderThirdPartyLicenseNotices,
  type PackageLicenseNotice,
} from "./third-party-license-notices.ts";

const packageDirectory = resolve(import.meta.dirname, "..");
const clientDirectory = resolve(
  packageDirectory,
  "..",
  "xorbix-visual-databricks-app-builder.client",
);
const inventorySources = [
  {
    label: "VDAB Node runtime",
    lockfilePath: resolve(packageDirectory, "runtime", "package-lock.json"),
    nodeModulesDirectory: resolve(packageDirectory, "node_modules"),
  },
  {
    label: "VDAB client and build toolchain",
    lockfilePath: resolve(clientDirectory, "package-lock.json"),
    nodeModulesDirectory: resolve(clientDirectory, "node_modules"),
  },
] as const;
const inventoryItems: PackageLicenseInventoryItem[] = [];
const noticeItems: PackageLicenseNotice[] = [];

for (const source of inventorySources) {
  const lockfileText = await readFile(source.lockfilePath, "utf8");
  const lockfile: unknown = JSON.parse(lockfileText);
  inventoryItems.push(
    ...collectPackageLicenseInventory(source.label, lockfile),
  );
  noticeItems.push(
    ...(await collectPackageLicenseNotices(
      source.label,
      lockfile,
      source.nodeModulesDirectory,
    )),
  );
}

noticeItems.push({
  source: "Generated Lakebase-backed child Apps",
  packageName: ASYNC_PG_PACKAGE_NAME,
  version: ASYNC_PG_PACKAGE_VERSION,
  declaredLicense: "Apache-2.0",
  status: "INCLUDED",
  documents: [{ fileName: "LICENSE", text: ASYNC_PG_LICENSE_TEXT }],
});

const inventoryPath = resolve(
  packageDirectory,
  "DEPENDENCY_LICENSE_INVENTORY.md",
);
const noticesPath = resolve(packageDirectory, "THIRD_PARTY_NOTICES.md");
await Promise.all([
  writeFile(
    inventoryPath,
    renderPackageLicenseInventory(inventoryItems),
    "utf8",
  ),
  writeFile(noticesPath, renderThirdPartyLicenseNotices(noticeItems), "utf8"),
]);
process.stdout.write(
  `${JSON.stringify({ event: "app.dependency-license-documents.generated", inventoryEntries: inventoryItems.length, noticeEntries: noticeItems.length })}\n`,
);
