import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  ASYNC_PG_LICENSE_FILE_PATH,
  ASYNC_PG_LICENSE_SOURCE_URL,
  ASYNC_PG_LICENSE_SHA256,
  ASYNC_PG_LICENSE_TEXT,
  ASYNC_PG_PACKAGE_NAME,
  ASYNC_PG_PACKAGE_VERSION,
} from "../src/generation/asyncpg-package-notice.ts";
import {
  collectPackageLicenseNotices,
  renderThirdPartyLicenseNotices,
} from "../../scripts/third-party-license-notices.ts";

test("CollectPackageLicenseNotices_CopiesInstalledTextAndReportsMissingFiles", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "vdab-package-notices-"),
  );
  const modulesDirectory = resolve(temporaryDirectory, "node_modules");
  const widgetDirectory = resolve(modulesDirectory, "@scope", "widget");
  const missingNoticeDirectory = resolve(modulesDirectory, "missing-notice");
  await mkdir(widgetDirectory, { recursive: true });
  await mkdir(missingNoticeDirectory, { recursive: true });
  await writeFile(
    resolve(widgetDirectory, "package.json"),
    JSON.stringify({ name: "@scope/widget", version: "1.2.3" }),
    "utf8",
  );
  await writeFile(
    resolve(missingNoticeDirectory, "package.json"),
    JSON.stringify({ name: "missing-notice", version: "4.5.6" }),
    "utf8",
  );
  await writeFile(
    resolve(widgetDirectory, "LICENSE"),
    "Copyright Test Holder\r\nTerms include <scope> & safety.\r\n",
    "utf8",
  );

  try {
    const lockfile = {
      packages: {
        "": { name: "vdab" },
        "node_modules/@scope/widget": {
          version: "1.2.3",
          license: "MIT",
        },
        "node_modules/missing-notice": {
          version: "4.5.6",
          license: { type: "Apache-2.0" },
        },
        "node_modules/uninstalled-required": {
          version: "6.7.8",
          license: "MIT",
        },
        "node_modules/optional-platform": {
          version: "7.8.9",
          license: "MIT",
          optional: true,
        },
      },
    };

    const notices = await collectPackageLicenseNotices(
      "test lock",
      lockfile,
      modulesDirectory,
    );
    const widget = notices.find(
      (notice) => notice.packageName === "@scope/widget",
    );
    const missing = notices.find(
      (notice) => notice.packageName === "missing-notice",
    );
    const optional = notices.find(
      (notice) => notice.packageName === "optional-platform",
    );
    const uninstalledRequired = notices.find(
      (notice) => notice.packageName === "uninstalled-required",
    );

    assert.equal(widget?.status, "INCLUDED");
    assert.equal(
      widget?.documents[0]?.text,
      "Copyright Test Holder\nTerms include <scope> & safety.\n",
    );
    assert.equal(missing?.status, "NO_NOTICE_FILE");
    assert.equal(uninstalledRequired?.status, "NOT_INSTALLED");
    assert.equal(optional?.status, "OPTIONAL_PACKAGE_NOT_INSTALLED");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("CollectPackageLicenseNotices_RejectsTraversalPackagePaths", async () => {
  await assert.rejects(
    collectPackageLicenseNotices(
      "test lock",
      { packages: { "node_modules/../../outside": { version: "1.0.0" } } },
      resolve(tmpdir(), "vdab-empty-modules"),
    ),
    /unsafe package path/,
  );
});

test("CollectPackageLicenseNotices_RejectsInstalledVersionNotMatchingLock", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "vdab-package-version-"),
  );
  const modulesDirectory = resolve(temporaryDirectory, "node_modules");
  const packageDirectory = resolve(modulesDirectory, "versioned");
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    resolve(packageDirectory, "package.json"),
    JSON.stringify({ name: "versioned", version: "2.0.0" }),
    "utf8",
  );

  try {
    await assert.rejects(
      collectPackageLicenseNotices(
        "test lock",
        { packages: { "node_modules/versioned": { version: "1.0.0" } } },
        modulesDirectory,
      ),
      /does not match lockfile version/,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("AsyncpgLicense_MatchesPinnedVersionedUpstreamDigest", () => {
  const actualDigest = createHash("sha256")
    .update(ASYNC_PG_LICENSE_TEXT, "utf8")
    .digest("hex")
    .toUpperCase();

  assert.equal(actualDigest, ASYNC_PG_LICENSE_SHA256);
});

test("RenderThirdPartyLicenseNotices_EscapesTextAndListsManualReviewItems", () => {
  const output = renderThirdPartyLicenseNotices([
    {
      source: "client | build",
      packageName: "@scope/widget",
      version: "1.2.3",
      declaredLicense: "MIT",
      status: "INCLUDED",
      documents: [
        {
          fileName: "LICENSE",
          text: "Terms include <script> & remain visible.",
        },
      ],
    },
    {
      source: "client | build",
      packageName: "missing-notice",
      version: "4.5.6",
      declaredLicense: "Apache-2.0",
      status: "NO_NOTICE_FILE",
      documents: [],
    },
    {
      source: "Generated Lakebase-backed child Apps",
      packageName: ASYNC_PG_PACKAGE_NAME,
      version: ASYNC_PG_PACKAGE_VERSION,
      declaredLicense: "Apache-2.0",
      status: "INCLUDED",
      documents: [{ fileName: "LICENSE", text: ASYNC_PG_LICENSE_TEXT }],
    },
  ]);

  assert.match(output, /client \\\| build/);
  assert.match(output, /Terms include &lt;script&gt; &amp; remain visible\./);
  assert.match(output, /NO_NOTICE_FILE/);
  assert.match(output, /asyncpg==0\.32\.0/);
  assert.ok(output.includes(ASYNC_PG_LICENSE_SOURCE_URL));
  assert.ok(output.includes(ASYNC_PG_LICENSE_FILE_PATH));
  const escapedLicense = ASYNC_PG_LICENSE_TEXT.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  assert.ok(output.includes(escapedLicense));
});
