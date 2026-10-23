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

test("ProjectPreviewGenerator_RejectsInvalidTabsAndChildLayouts", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidTabs = [
    createTabs({ properties: { tabs: [] } }),
    createTabs({ properties: { tabs: [" "] } }),
    createTabs({ properties: { tabs: ["x".repeat(101)] } }),
    createTabs({ properties: { tabs: ["One"], defaultTabIndex: 1 } }),
    createTabs({ properties: { tabs: ["Same", "Same"], defaultTabIndex: 1 } }),
    createTabs({ properties: { tabs: ["One"], extra: true } }),
    createTabs({ schemaVersion: 2 }),
    createTabs({ bindings: { table: "workspace-table" } }),
    createTabs({ layout: { y: 1 } }),
  ];

  for (const component of invalidTabs) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_tabs_properties",
    );
  }

  const invalidTrees = [
    [createTabs({ children: ["missing-child"] })],
    [createTabs({ children: ["child"] }), createTextInput({ key: "child" })],
    [createTabs({ children: ["child"] }), createTextInput({ key: "child", layout: { tabIndex: 2, y: 0 } })],
    [createTabs({ children: ["nested-layout"] }), createRows({ key: "nested-layout" })],
    [
      createTabs({ children: ["child"] }),
      createTextInput({ key: "child", layout: { tabIndex: 0, y: 0 }, children: ["nested"] }),
      createTextInput({ key: "nested" }),
    ],
  ];

  for (const components of invalidTrees) {
    assert.throws(
      () => generator.generate(project, createDocument(components)),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        (error.code === "invalid_component_tree" || error.code === "invalid_tabs_properties"),
    );
  }
});


test("ProjectPreviewGenerator_FormMatchesAcceptedPythonFixture", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/form-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const form = createForm({
    properties: {
      submitButtonText: "Save O'Brien",
      clearOnSubmit: true,
      enterToSubmit: false,
      border: false,
      width: 720,
      height: "content",
    },
    children: ["form-name", "form-approved"],
  });
  const input = createTextInput({
    key: "form-name",
    codeName: "recordName",
    properties: {
      label: "Record name",
      placeholder: "Name",
      defaultValue: "",
      help: "Enter a name.",
      disabled: false,
      type: "default",
      multiline: false,
      height: "",
    },
  });
  const checkbox = createCheckbox({
    key: "form-approved",
    codeName: "approved",
    properties: {
      label: "Approved",
      defaultChecked: true,
      help: "Confirm this record.",
      disabled: false,
    },
  });
  const preview = new ProjectPreviewGenerator().generate(
    project,
    createDocument([form, input, checkbox]),
  );

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
  assert.match(expectedPython, /st\.form_submit_button\('Save O\\'Brien'\)/);
  assert.ok(expectedPython.indexOf("st.text_input(") < expectedPython.indexOf("st.checkbox("));
});


test("ProjectPreviewGenerator_FormUsesValidEmptyFormAndRejectsInvalidChildren", () => {
  const generator = new ProjectPreviewGenerator();
  const emptySource = generator.generate(project, createDocument([createForm()]))
    .files[0]?.content ?? "";

  assert.match(emptySource, /with st\.form\(/);
  assert.match(emptySource, /st\.info\('Drag components into this form container'\)/);
  assert.match(emptySource, /if submitted:\n    st\.toast\('Form submitted successfully!'\)/);

  const invalidForms = [
    createForm({ properties: { width: "wide" } }),
    createForm({ properties: { height: 10_001 } }),
    createForm({ properties: { submitButtonText: "x".repeat(2001) } }),
    createForm({ properties: { submitButtonText: "Submit", unexpected: true } }),
    createForm({ schemaVersion: 2 }),
    createForm({ bindings: { table: "outside" } }),
    createForm({ layout: { y: 1 } }),
  ];

  for (const form of invalidForms) {
    assert.throws(
      () => generator.generate(project, createDocument([form])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_form_properties",
    );
  }

  const invalidTrees = [
    [createForm({ children: ["missing"] })],
    [createForm({ children: ["button"] }), createButton({ key: "button" })],
    [createForm({ children: ["nested-form"] }), createForm({ key: "nested-form" })],
    [
      createForm({ children: ["nested-child"] }),
      createTextInput({ key: "nested-child", children: ["grandchild"] }),
      createTextInput({ key: "grandchild" }),
    ],
  ];

  for (const components of invalidTrees) {
    assert.throws(
      () => generator.generate(project, createDocument(components)),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        (error.code === "invalid_component_tree" || error.code === "invalid_form_properties"),
    );
  }
});


test("ProjectPreviewGenerator_ModalMatchesAcceptedPythonFixtureWithNestedLayout", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/modal-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const modal = createModal({
    codeName: "reviewDialog",
    properties: { title: "Review O'Brien", width: "medium", height: 640 },
    children: ["details"],
  });
  const details = createExpander({
    key: "details",
    codeName: "modalDetails",
    properties: { sectionTitle: "Details", defaultExpanded: true },
    children: ["modal-note"],
  });
  const note = createTextInput({
    key: "modal-note",
    codeName: "modalNote",
    properties: {
      label: "Review note",
      placeholder: "Add a note",
      defaultValue: "",
      help: "Describe the change.",
      disabled: false,
      type: "default",
      multiline: false,
      height: "",
    },
  });
  const preview = new ProjectPreviewGenerator().generate(
    project,
    createDocument([modal, details, note]),
  );

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
  assert.match(expectedPython, /def show_reviewDialog\(\):/);
  assert.match(expectedPython, /position='center', dismissible=True/);
  assert.match(expectedPython, /st\.button\('Close', key='vdab_reviewdialog_close'\)/);
});
