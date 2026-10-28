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
  generateLakebaseProvisionedTestApp,
  generateLakebaseTestApp,
} from "../../scripts/lakebase-test-app.ts";

import { project, createDocument, createTextInput, createButton, createCheckbox, createToggle, createDropdown, createDatePicker, createTimePicker, createSlider, createLabel, createExpander, createColumns, createRows, createTabs, createForm, createModal } from "./project-preview-generator-test-support.ts";
import { createFileUpload, createDataWindow, createEditableDataWindow, createEditableDataWindowBinding, createProvisionedLakebaseBinding, isRecord } from "./project-preview-generator-data-test-support.ts";

test("ProjectPreviewGenerator_ModalValidatesPropertiesTreesAndOrdering", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidModals = [
    createModal({ properties: { title: " " } }),
    createModal({ properties: { title: "Review", width: "wide" } }),
    createModal({ properties: { title: "Review", height: "auto" } }),
    createModal({ properties: { title: "Review", position: "top" } }),
    createModal({ properties: { title: "Review", dismissible: "yes" } }),
    createModal({ properties: { title: "x".repeat(2001) } }),
    createModal({ schemaVersion: 2 }),
    createModal({ bindings: { table: "resource" } }),
    createModal({ layout: { y: 1 } }),
  ];

  for (const modal of invalidModals) {
    assert.throws(
      () => generator.generate(project, createDocument([modal])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_modal_properties",
    );
  }

  const orderedSource = generator.generate(
    project,
    createDocument([
      createModal({ children: ["later", "earlier"] }),
      createTextInput({ key: "later", codeName: "laterNote", layout: { y: 1 } }),
      createCheckbox({ key: "earlier", codeName: "earlierCheck", layout: { y: 0 } }),
    ]),
  ).files[0]?.content ?? "";
  const dialogBody = orderedSource.slice(orderedSource.indexOf("def show_mainModal():"));
  assert.ok(dialogBody.indexOf("st.checkbox(") < dialogBody.indexOf("st.text_input("));

  const invalidTrees = [
    [createModal({ children: ["missing"] })],
    [createModal({ children: ["nested"] }), createModal({ key: "nested" })],
    [
      createModal({ children: ["control"] }),
      createTextInput({ key: "control", children: ["grandchild"] }),
      createTextInput({ key: "grandchild" }),
    ],
  ];

  for (const components of invalidTrees) {
    assert.throws(
      () => generator.generate(project, createDocument(components)),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_component_tree",
    );
  }
});


test("ProjectPreviewGenerator_FileUploadMatchesCallerAuthorizedVolumePythonFixture", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/file-upload-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = new ProjectPreviewGenerator().generate(
    project,
    createDocument([
      createFileUpload({
        bindings: {
          databricksVolume: {
            bindingType: "databricksVolume",
            source: {
              kind: "resource",
              valueType: "file",
              resource: {
                type: "databricksVolume",
                catalog: "main",
                schema: "landing",
                volume: "incoming",
                filePath: "imports/2026",
              },
            },
          },
        },
      }),
    ]),
  );

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
  assert.match(expectedPython, /accept_multiple_files=True/);
  assert.match(expectedPython, /_vdab_upload_to_volume\(/);
  assert.match(expectedPython, /class _VDABNoRedirectHandler\(urllib\.request\.HTTPRedirectHandler\)/);
  assert.match(expectedPython, /_vdab_open_no_redirect\(request\)/);
  assert.doesNotMatch(expectedPython, /urlopen\(request, timeout=30\)/);
  assert.match(expectedPython, /x-forwarded-access-token/);
  assert.match(expectedPython, /two files use the same destination name/);
  assert.doesNotMatch(expectedPython, /caller-token|workspaceConnectionId/i);
});
