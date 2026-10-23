import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  ASYNC_PG_LICENSE_FILE_PATH,
  ASYNC_PG_PACKAGE_NAME,
  ASYNC_PG_PACKAGE_VERSION,
  ASYNC_PG_LICENSE_SOURCE_URL,
} from "../server/src/generation/asyncpg-package-notice.ts";

const NODE_MODULES_PREFIX = "node_modules/";
const LICENSE_DOCUMENT_NAME = /^(license|licence|copying|notice)([-_.].*)?$/i;
const MAX_LICENSE_DOCUMENT_BYTES = 262_144;
const OVERSIZED_DOCUMENT = "DOCUMENT_TOO_LARGE";
const MISSING_DOCUMENT = "NO_NOTICE_FILE";
const NOT_INSTALLED = "NOT_INSTALLED";
const OPTIONAL_NOT_INSTALLED = "OPTIONAL_PACKAGE_NOT_INSTALLED";
const INCLUDED = "INCLUDED";

/** Result of collecting package-supplied text for a locked package. */
export type PackageLicenseNoticeStatus =
  | typeof INCLUDED
  | typeof MISSING_DOCUMENT
  | typeof NOT_INSTALLED
  | typeof OPTIONAL_NOT_INSTALLED
  | typeof OVERSIZED_DOCUMENT;

/** License or notice text supplied adjacent to an installed npm package. */
export interface PackageLicenseDocument {
  readonly fileName: string;
  readonly text: string;
}

/** One locked dependency and the license files found in its installed folder. */
export interface PackageLicenseNotice {
  readonly source: string;
  readonly packageName: string;
  readonly version: string;
  readonly declaredLicense: string;
  readonly status: PackageLicenseNoticeStatus;
  readonly documents: readonly PackageLicenseDocument[];
}

/**
 * Finds package-supplied license and notice files without accessing a registry.
 * Missing optional packages are recorded because their platform variants may
 * not be installed on the machine producing the package.
 */
export async function collectPackageLicenseNotices(
  source: string,
  lockfile: unknown,
  nodeModulesDirectory: string,
): Promise<PackageLicenseNotice[]> {
  const lockRecord = readRecord(lockfile, "npm lockfile");
  const packageRecords = readRecord(
    lockRecord.packages,
    "npm lockfile packages",
  );
  const packagesByIdentity = new Map<string, PackageLicenseNotice>();
  const absoluteModulesDirectory = resolve(nodeModulesDirectory);

  for (const [packagePath, packageValue] of Object.entries(packageRecords)) {
    if (!packagePath.startsWith(NODE_MODULES_PREFIX)) {
      continue;
    }

    const packageRecord = readRecord(packageValue, `package ${packagePath}`);
    const packageName = getPackageName(packagePath);
    const packageDirectory = resolve(
      absoluteModulesDirectory,
      packagePath.slice(NODE_MODULES_PREFIX.length),
    );
    if (!isChildPath(absoluteModulesDirectory, packageDirectory)) {
      throw new Error(
        `The lockfile contains an unsafe package path: ${packagePath}`,
      );
    }

    const documentsOrMissing = await readPackageDocuments(
      packageDirectory,
      readString(packageRecord.version),
    );
    const documents = documentsOrMissing ?? [];
    const status = getPackageStatus(
      documentsOrMissing !== undefined,
      documents,
      packageRecord.optional === true,
    );
    const notice: PackageLicenseNotice = {
      source,
      packageName,
      version: readString(packageRecord.version) ?? "UNKNOWN",
      declaredLicense: readLicense(packageRecord.license),
      status,
      documents,
    };
    mergeNotice(packagesByIdentity, notice);
  }

  return [...packagesByIdentity.values()].sort(comparePackageNotices);
}

/** Renders package metadata, missing-file findings, and available full text. */
export function renderThirdPartyLicenseNotices(
  notices: readonly PackageLicenseNotice[],
): string {
  const orderedNotices = [...notices].sort(comparePackageNotices);
  const documentGroups = groupDocuments(orderedNotices);
  const packageRows = orderedNotices.map((notice) => {
    const files = notice.documents
      .map((document) => document.fileName)
      .join(", ");
    return `| ${escapeTableCell(notice.source)} | ${escapeTableCell(notice.packageName)} | ${escapeTableCell(notice.version)} | ${escapeTableCell(notice.declaredLicense)} | ${escapeTableCell(files || "—")} | ${escapeTableCell(notice.status)} |`;
  });
  const missingCount = orderedNotices.filter(
    (notice) => notice.status !== INCLUDED,
  ).length;

  return [
    "# Third-party license and notice files",
    "",
    "Generated offline from the committed npm lockfiles, package folders already installed on this machine, and the pinned generated child-app dependency. Included text is copied from package-supplied files. This report is not legal approval, does not determine which license option VDAB selects, and does not prove that every listed development or optional package is redistributed.",
    "",
    `The report has ${orderedNotices.length} distinct package/version/license records and ${documentGroups.length} distinct license or notice texts. ${missingCount} records have a missing, uninstalled, or oversized package-supplied document and require review before publication.`,
    "",
    "| Source | Package | Version | Declared license | Included package files | Collection status |",
    "| --- | --- | --- | --- | --- | --- |",
    ...packageRows,
    "",
    "## Available package-supplied text",
    "",
    ...documentGroups.flatMap((group, index) => [
      `### Document ${index + 1}: ${escapeMarkdown(group.fileNames.join(", "))}`,
      "",
      `Packages: ${escapeMarkdown(group.packages.join(", "))}`,
      "",
      "<pre>",
      escapeHtml(group.text),
      "</pre>",
      "",
    ]),
    "## Generated child-app dependency",
    "",
    `Generated Lakebase-backed child apps pin \`${ASYNC_PG_PACKAGE_NAME}==${ASYNC_PG_PACKAGE_VERSION}\` (Apache-2.0). The exact license text from the [official versioned source](${ASYNC_PG_LICENSE_SOURCE_URL}) is included above and emitted with each Lakebase-backed source bundle at \`${ASYNC_PG_LICENSE_FILE_PATH}\`.`,
    "",
    "The product license, third-party redistribution terms, notice completeness, and any required SPDX SBOM still need owner/legal review. See `DEPENDENCY_LICENSE_INVENTORY.md` and the Step 6 release gate.",
    "",
  ].join("\n");
}

async function readPackageDocuments(
  packageDirectory: string,
  lockedVersion: string | undefined,
): Promise<PackageLicenseDocument[] | undefined> {
  let directoryEntries: Dirent[];
  try {
    directoryEntries = await readdir(packageDirectory, { withFileTypes: true });
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return undefined;
    }
    throw error;
  }

  await verifyInstalledVersion(packageDirectory, lockedVersion);

  const documents: PackageLicenseDocument[] = [];
  const documentEntries = directoryEntries
    .filter((entry) => entry.isFile() && LICENSE_DOCUMENT_NAME.test(entry.name))
    .sort((left, right) => compareStrings(left.name, right.name));

  for (const entry of documentEntries) {
    const documentPath = resolve(packageDirectory, entry.name);
    if (!isChildPath(packageDirectory, documentPath)) {
      throw new Error("The package contains an invalid license document path.");
    }
    const documentStat = await stat(documentPath);
    if (documentStat.size > MAX_LICENSE_DOCUMENT_BYTES) {
      documents.push({ fileName: entry.name, text: OVERSIZED_DOCUMENT });
      continue;
    }
    const text = (await readFile(documentPath, "utf8")).replace(/^\uFEFF/, "");
    documents.push({ fileName: entry.name, text: normalizeNewlines(text) });
  }

  return documents;
}

async function verifyInstalledVersion(
  packageDirectory: string,
  lockedVersion: string | undefined,
): Promise<void> {
  const manifestPath = resolve(packageDirectory, "package.json");
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = readRecord(
    JSON.parse(manifestText) as unknown,
    "package manifest",
  );
  const installedVersion = readString(manifest.version);
  if (lockedVersion !== undefined && installedVersion !== lockedVersion) {
    throw new Error(
      `Installed package version ${installedVersion ?? "UNKNOWN"} does not match lockfile version ${lockedVersion}.`,
    );
  }
}

function getPackageStatus(
  installed: boolean,
  documents: readonly PackageLicenseDocument[],
  optional: boolean,
): PackageLicenseNoticeStatus {
  if (documents.some((document) => document.text === OVERSIZED_DOCUMENT)) {
    return OVERSIZED_DOCUMENT;
  }
  if (documents.length > 0) {
    return INCLUDED;
  }
  if (!installed) {
    return optional ? OPTIONAL_NOT_INSTALLED : NOT_INSTALLED;
  }
  return MISSING_DOCUMENT;
}

function mergeNotice(
  noticesByIdentity: Map<string, PackageLicenseNotice>,
  notice: PackageLicenseNotice,
): void {
  const identity = [
    notice.source,
    notice.packageName,
    notice.version,
    notice.declaredLicense,
  ].join("\u0000");
  const existing = noticesByIdentity.get(identity);
  if (existing === undefined) {
    noticesByIdentity.set(identity, notice);
    return;
  }

  const mergedDocuments = new Map<string, PackageLicenseDocument>();
  for (const document of [...existing.documents, ...notice.documents]) {
    mergedDocuments.set(`${document.fileName}\u0000${document.text}`, document);
  }
  const documents = [...mergedDocuments.values()].sort((left, right) =>
    compareStrings(left.fileName, right.fileName),
  );
  noticesByIdentity.set(identity, {
    ...existing,
    status: getMergedStatus(existing.status, notice.status, documents),
    documents,
  });
}

function getMergedStatus(
  existingStatus: PackageLicenseNoticeStatus,
  incomingStatus: PackageLicenseNoticeStatus,
  documents: readonly PackageLicenseDocument[],
): PackageLicenseNoticeStatus {
  if (documents.some((document) => document.text === OVERSIZED_DOCUMENT)) {
    return OVERSIZED_DOCUMENT;
  }
  if (documents.length > 0) {
    return INCLUDED;
  }
  if (existingStatus === NOT_INSTALLED || incomingStatus === NOT_INSTALLED) {
    return NOT_INSTALLED;
  }
  if (
    existingStatus === MISSING_DOCUMENT ||
    incomingStatus === MISSING_DOCUMENT
  ) {
    return MISSING_DOCUMENT;
  }
  return OPTIONAL_NOT_INSTALLED;
}

function groupDocuments(
  notices: readonly PackageLicenseNotice[],
): Array<{ fileNames: string[]; packages: string[]; text: string }> {
  const groupsByContent = new Map<
    string,
    { fileNames: Set<string>; packages: Set<string>; text: string }
  >();

  for (const notice of notices) {
    for (const document of notice.documents) {
      if (document.text === OVERSIZED_DOCUMENT) {
        continue;
      }
      const identity = createHash("sha256").update(document.text).digest("hex");
      const group = groupsByContent.get(identity) ?? {
        fileNames: new Set<string>(),
        packages: new Set<string>(),
        text: document.text,
      };
      group.fileNames.add(document.fileName);
      group.packages.add(
        `${notice.source}: ${notice.packageName}@${notice.version}`,
      );
      groupsByContent.set(identity, group);
    }
  }

  return [...groupsByContent.values()]
    .map((group) => ({
      fileNames: [...group.fileNames].sort(compareStrings),
      packages: [...group.packages].sort(compareStrings),
      text: group.text,
    }))
    .sort((left, right) => compareStrings(left.text, right.text));
}

function getPackageName(packagePath: string): string {
  const nestedMarker = "/node_modules/";
  const nestedIndex = packagePath.lastIndexOf(nestedMarker);
  const packageName =
    nestedIndex >= 0
      ? packagePath.slice(nestedIndex + nestedMarker.length)
      : packagePath.slice(NODE_MODULES_PREFIX.length);
  if (packageName.length === 0) {
    throw new Error(
      `The lockfile contains an invalid package path: ${packagePath}`,
    );
  }
  return packageName;
}

function readLicense(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  const record = tryReadRecord(value);
  return readString(record?.type)?.trim() || "UNDECLARED";
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

function isChildPath(parentPath: string, candidatePath: string): boolean {
  const childPath = relative(parentPath, candidatePath);
  return (
    childPath.length > 0 &&
    childPath !== ".." &&
    !childPath.startsWith(`..${sep}`) &&
    !isAbsolute(childPath)
  );
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function normalizeNewlines(value: string): string {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function comparePackageNotices(
  left: PackageLicenseNotice,
  right: PackageLicenseNotice,
): number {
  return (
    compareStrings(left.source, right.source) ||
    compareStrings(left.packageName, right.packageName) ||
    compareStrings(left.version, right.version) ||
    compareStrings(left.declaredLicense, right.declaredLicense)
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

function escapeMarkdown(value: string): string {
  return value
    .replaceAll("`", "\\`")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
