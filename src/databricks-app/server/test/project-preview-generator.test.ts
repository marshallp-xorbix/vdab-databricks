import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "../src/db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../src/db/project-workflow-contract.ts";
import { ApplicationError } from "../src/application-error.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";
import {
  ASYNC_PG_LICENSE_FILE_PATH,
  ASYNC_PG_LICENSE_TEXT,
} from "../src/generation/asyncpg-package-notice.ts";
import {
  generateLakebaseProvisionedTestApp,
  generateLakebaseTestApp,
} from "../../scripts/lakebase-test-app.ts";

import {
  project,
  createDocument,
  createTextInput,
  createButton,
  createCheckbox,
  createToggle,
  createDropdown,
  createDatePicker,
  createTimePicker,
  createSlider,
  createLabel,
  createExpander,
  createColumns,
  createRows,
  createTabs,
  createForm,
  createModal,
} from "./project-preview-generator-test-support.ts";
import {
  createFileUpload,
  createDataWindow,
  createEditableDataWindow,
  createEditableDataWindowBinding,
  createProvisionedLakebaseBinding,
  isRecord,
} from "./project-preview-generator-data-test-support.ts";

test("ProjectPreviewGenerator_TextInputMatchesAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const document = createDocument([createTextInput()]);
  const fixturePath = new URL(
    "./fixtures/contracts/generated/textinput-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");

  const preview = generator.generate(project, document);

  assert.equal(preview.projectId, "project-preview");
  assert.equal(preview.version, 4);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.files.find((file) => file.path === "app.py")?.content, expectedPython);
  assert.deepEqual(preview.files.map((file) => file.path), [
    "app.py",
    "app.yaml",
    "custom_modules.py",
    "requirements.txt",
    ".streamlit/config.toml",
  ]);
});

test("ProjectPreviewGenerator_ButtonMatchesAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "./fixtures/contracts/generated/button-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = generator.generate(project, createDocument([createButton()]));

  assert.equal(preview.files.find((file) => file.path === "app.py")?.content, expectedPython);
  assert.equal(preview.previewOnly, true);
});

test("ProjectPreviewGenerator_EmitsStreamlitThemeConfiguration", () => {
  const generator = new ProjectPreviewGenerator();
  const themedProject = {
    ...project,
    theme: {
      primaryColor: "#123456",
      backgroundColor: "invalid",
      textColor: "#ABCDEF",
    },
  } satisfies ProjectSummary;

  const preview = generator.generate(themedProject, createDocument([]));

  assert.deepEqual(preview.files.find((file) => file.path === ".streamlit/config.toml"), {
    path: ".streamlit/config.toml",
    content: '[theme]\nprimaryColor = "#123456"\nbackgroundColor = "#252526"\nsecondaryBackgroundColor = "#2D2D30"\ntextColor = "#ABCDEF"\n',
  });
});

test("ProjectPreviewGenerator_EmitsSavedPageWidthInGeneratedStreamlitSource", () => {
  const preview = new ProjectPreviewGenerator().generate(
    { ...project, theme: { pageWidth: 1120 } },
    createDocument([]),
  );
  const source = preview.files.find((file) => file.path === "app.py")?.content ?? "";

  assert.match(source, /\.block-container \{ max-width: 1120px; \}/);
});

test("ProjectPreviewGenerator_AddsApprovedAsyncpgOnlyForLakebaseBackedOutput", () => {
  const generator = new ProjectPreviewGenerator();
  const lakebaseBinding: NonNullable<ProjectComponent["bindings"]> = {
    lakebaseAutoscaling: {
      bindingType: "lakebaseAutoscaling",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "lakebaseAutoscaling",
          database: "appdb",
          databaseId: "database-id",
          projectId: "lakebase-project",
          branchId: "production",
          endpointId: "read-write",
          catalog: null,
          schema: "public",
          table: "orders",
          dataSourceFormat: null,
          primaryKeyColumn: null,
          columns: [{ name: "customer_name", type: "TEXT" }],
        },
      },
    },
  };

  const lakebasePreview = generator.generate(
    project,
    createDocument([createDataWindow({ bindings: lakebaseBinding })]),
  );
  const unityCatalogPreview = generator.generate(
    project,
    createDocument([createDataWindow()]),
  );

  assert.deepEqual(
    lakebasePreview.files.map((file) => file.path),
    ["app.py", "app.yaml", "custom_modules.py", "requirements.txt", ".streamlit/config.toml", ASYNC_PG_LICENSE_FILE_PATH],
  );
  assert.equal(lakebasePreview.files.find((file) => file.path === "requirements.txt")?.content, "asyncpg==0.32.0\n");
  assert.equal(lakebasePreview.files.find((file) => file.path === ASYNC_PG_LICENSE_FILE_PATH)?.content, ASYNC_PG_LICENSE_TEXT);
  assert.match(
    lakebasePreview.files[0]?.content ?? "",
    /source_kind='lakebaseAutoscaling'/,
  );
  assert.match(
    lakebasePreview.files[0]?.content ?? "",
    /projects\/lakebase-project\/branches\/production\/endpoints\/read-write/,
  );
  assert.deepEqual(
    unityCatalogPreview.files.map((file) => file.path),
    ["app.py", "app.yaml", "custom_modules.py", "requirements.txt", ".streamlit/config.toml"],
  );
  assert.doesNotMatch(
    unityCatalogPreview.files[0]?.content ?? "",
    /import asyncpg/,
  );
});

test("ProjectPreviewGenerator_UsesViewerAuthorizedDatabaseInstanceCredentialsForProvisionedLakebase", () => {
  const preview = new ProjectPreviewGenerator().generate(
    project,
    createDocument([
      createDataWindow({ bindings: createProvisionedLakebaseBinding() }),
    ]),
  );
  const source = preview.files.find((file) => file.path === "app.py")?.content ?? "";

  assert.equal(preview.files.find((file) => file.path === "requirements.txt")?.content, "asyncpg==0.32.0\n");
  assert.match(
    source,
    /_vdab_lakebase_provisioned_query_df\('public', 'customers', 100/,
  );
  assert.match(source, /\/api\/2\.0\/database\/instances\//);
  assert.match(source, /\/api\/2\.0\/database\/credentials/);
  assert.match(source, /'instance_names': \[instance_name\]/);
  assert.match(source, /ep-\[a-z0-9-\]\+\\\.database/);
  assert.match(source, /host\.lower\(\) != instance_host\.lower\(\)/);
  assert.match(
    source,
    /st\.context\.headers\.get\('x-forwarded-access-token'\)/,
  );
  assert.match(source, /default_transaction_read_only/);
  assert.doesNotMatch(
    source,
    /DATABRICKS_CLIENT_SECRET|DATABRICKS_TOKEN|workspaceConnectionId/,
  );
});

test("ProjectPreviewGenerator_ExecutesProvisionedLakebaseReadAndEditableWriteWithViewerIdentity", () => {
  const preview = generateLakebaseProvisionedTestApp();
  const pythonExecutable =
    process.env.VDAB_PYTHON_EXECUTABLE ??
    (process.platform === "win32" ? "python" : "python3");
  const harnessPath = resolve(
    import.meta.dirname,
    "../../scripts/smoke-generated-workflow.py",
  );
  const result = spawnSync(pythonExecutable, [harnessPath], {
    input: JSON.stringify({
      scenario: "lakebase-provisioned",
      files: preview.files,
    }),
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 1_000_000,
  });

  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report: unknown = JSON.parse(result.stdout);
  assert.ok(
    isRecord(report) && report.event === "generated-workflow-smoke.passed",
  );
  assert.deepEqual(report.checks, [
    "provisioned-data-window-chart-story-and-editable-readers",
    "provisioned-editable-transactional-write",
    "provisioned-buildsql-runsql-parameterized-savetable",
    "provisioned-identity-and-denial-no-fallback",
  ]);
});

test("ProjectPreviewGenerator_ExecutesLakebaseWorkflowWithViewerScopedPostgresRuntime", () => {
  const preview = generateLakebaseTestApp();
  const pythonExecutable =
    process.env.VDAB_PYTHON_EXECUTABLE ??
    (process.platform === "win32" ? "python" : "python3");
  const harnessPath = resolve(
    import.meta.dirname,
    "../../scripts/smoke-generated-workflow.py",
  );
  const result = spawnSync(pythonExecutable, [harnessPath], {
    input: JSON.stringify({ scenario: "lakebase", files: preview.files }),
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 1_000_000,
  });

  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report: unknown = JSON.parse(result.stdout);
  assert.ok(
    isRecord(report) && report.event === "generated-workflow-smoke.passed",
  );
  assert.deepEqual(report.checks, [
    "lakebase-postgres-sql-lexer",
    "lakebase-viewer-authorized-read-write",
    "lakebase-identity-and-result-bounds",
  ]);
});
