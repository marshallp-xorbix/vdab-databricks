const NODE_MODULES_PREFIX = "node_modules/";
const NESTED_NODE_MODULES_MARKER = "/node_modules/";
const UNDECLARED_LICENSE = "UNDECLARED";
const UNKNOWN_VERSION = "UNKNOWN";

/** One dependency and its declared license metadata from a package lock. */
export interface PackageLicenseInventoryItem {
  readonly source: string;
  readonly packageName: string;
  readonly version: string;
  readonly license: string;
}

/**
 * Extracts distinct installed package versions and their declared licenses
 * from an npm lockfile, retaining the lockfile's source label.
 */
export function collectPackageLicenseInventory(
  source: string,
  lockfile: unknown,
): PackageLicenseInventoryItem[] {
  const lockRecord = readRecord(lockfile, "npm lockfile");
  const packageRecords = readRecord(
    lockRecord.packages,
    "npm lockfile packages",
  );
  const itemsByIdentity = new Map<string, PackageLicenseInventoryItem>();

  for (const [packagePath, packageValue] of Object.entries(packageRecords)) {
    if (!packagePath.startsWith(NODE_MODULES_PREFIX)) {
      continue;
    }

    const packageRecord = readRecord(packageValue, `package ${packagePath}`);
    const item: PackageLicenseInventoryItem = {
      source,
      packageName: getPackageName(packagePath),
      version: readString(packageRecord.version) ?? UNKNOWN_VERSION,
      license: getLicense(packageRecord.license),
    };
    itemsByIdentity.set(getIdentity(item), item);
  }

  return [...itemsByIdentity.values()].sort(compareInventoryItems);
}

/** Renders a stable Markdown inventory from npm and generated-app metadata. */
export function renderPackageLicenseInventory(
  items: readonly PackageLicenseInventoryItem[],
): string {
  const rows = items.map(
    (item) =>
      `| ${escapeTableCell(item.source)} | ${escapeTableCell(item.packageName)} | ${escapeTableCell(item.version)} | ${escapeTableCell(item.license)} |`,
  );

  return [
    "# Dependency license inventory",
    "",
    "Generated from the committed npm lockfiles. This inventory records package metadata; it is not legal approval, a complete third-party notice, an SPDX SBOM, or proof that every listed package is redistributed in the final bundle. Review each package's actual license and notice requirements before publication.",
    "",
    "The client lockfile includes development, optional, and platform-specific packages because build tooling can contribute code to browser assets. Identical package/version/license entries are listed once per source lockfile.",
    "",
    "| Source lockfile | Package | Version | Declared license |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "## Generated child-app dependency",
    "",
    "| Package | Version | Declared license | Scope |",
    "| --- | --- | --- | --- |",
    "| `asyncpg` | `0.32.0` | Apache-2.0 | Added to a generated child's requirements only when the project uses Lakebase. |",
    "",
    "See `THIRD_PARTY_NOTICES.md` for the package-supplied license/notice text found in the currently installed lockfile packages and any package files requiring manual review. The owner/reviewer must decide whether additional texts, copyright notices, an SPDX SBOM, or other Marketplace submission material is required. The repository has no approved product license; see the transition release gate.",
    "",
  ].join("\n");
}

function getPackageName(packagePath: string): string {
  const nestedMarkerIndex = packagePath.lastIndexOf(NESTED_NODE_MODULES_MARKER);
  const packageName =
    nestedMarkerIndex >= 0
      ? packagePath.slice(nestedMarkerIndex + NESTED_NODE_MODULES_MARKER.length)
      : packagePath.slice(NODE_MODULES_PREFIX.length);
  if (packageName.length === 0) {
    throw new Error(
      `The lockfile contains an invalid package path: ${packagePath}`,
    );
  }
  return packageName;
}

function getLicense(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  const licenseRecord = tryReadRecord(value);
  const licenseType = readString(licenseRecord?.type);
  return licenseType?.trim() || UNDECLARED_LICENSE;
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  const record = tryReadRecord(value);
  if (record === undefined) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return record;
}

function tryReadRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getIdentity(item: PackageLicenseInventoryItem): string {
  return [item.source, item.packageName, item.version, item.license].join(
    "\u0000",
  );
}

function compareInventoryItems(
  left: PackageLicenseInventoryItem,
  right: PackageLicenseInventoryItem,
): number {
  return (
    compareStrings(left.source, right.source) ||
    compareStrings(left.packageName, right.packageName) ||
    compareStrings(left.version, right.version) ||
    compareStrings(left.license, right.license)
  );
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

function escapeTableCell(value: string): string {
  return value
    .replaceAll("|", "\\|")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}
