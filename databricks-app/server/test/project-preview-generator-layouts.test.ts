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

test("ProjectPreviewGenerator_ExpanderChildrenMatchOrderedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "./fixtures/contracts/generated/expander-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const expander = createExpander({
    properties: { sectionTitle: "Owner's details\nMore information", defaultExpanded: true },
    children: ["nested-label", "nested-input", "nested-button"],
  });
  const label = createLabel({
    key: "nested-label",
    codeName: "detailsLabel",
    properties: { text: "Details <summary>", fontSize: "large", bold: true },
  });
  const input = createTextInput({
    key: "nested-input",
    codeName: "additionalNotes",
    properties: {
      label: "Additional notes",
      placeholder: "Add context",
      defaultValue: "",
      help: "Optional details.",
      disabled: false,
      type: "default",
      multiline: true,
      height: "240",
    },
  });
  const button = createButton({
    key: "nested-button",
    codeName: "saveDetails",
    properties: { label: "Save details", variant: "primary", disabled: false, help: "" },
  });
  const preview = generator.generate(
    project,
    createDocument([expander, input, button, label]),
  );

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
  const source = preview.files[0]?.content ?? "";
  assert.equal((source.match(/st\.text_area\(/g) ?? []).length, 1);
  assert.ok(source.indexOf("html.escape(str(") < source.indexOf("st.text_area("));
  assert.ok(source.indexOf("st.text_area(") < source.indexOf("st.button("));
});


test("ProjectPreviewGenerator_ExpanderUsesPlaceholderWhenEmpty", () => {
  const generator = new ProjectPreviewGenerator();
  const source = generator.generate(project, createDocument([createExpander()]))
    .files[0]?.content ?? "";

  assert.match(source, /with st\.expander\('Section', expanded=False\):/);
  assert.match(source, /    st\.text\('Add components to expander'\)/);
});


test("ProjectPreviewGenerator_RejectsInvalidExpanderShapeAndTree", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidExpanders = [
    createExpander({ properties: { sectionTitle: "" } }),
    createExpander({ properties: { sectionTitle: "Details", defaultExpanded: "true" } }),
    createExpander({ properties: { sectionTitle: "Details", extra: true } }),
    createExpander({ bindings: { table: "workspace-table" } }),
    createExpander({ layout: { columns: 2 } }),
    createExpander({ schemaVersion: 2 }),
  ];

  for (const expander of invalidExpanders) {
    assert.throws(
      () => generator.generate(project, createDocument([expander])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_expander_properties",
    );
  }

  const invalidTrees = [
    [createExpander({ children: ["missing-child"] })],
    [createExpander({ children: ["nested-expander"] }), createExpander({ key: "nested-expander" })],
    [createExpander({ children: ["child-input"] }), createTextInput({ children: ["nested-input"] }), createTextInput({ key: "nested-input" })],
    [createExpander({ children: ["child-input", "child-input"] }), createTextInput()],
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


test("ProjectPreviewGenerator_ColumnsChildrenMatchOrderedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "./fixtures/contracts/generated/columns-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const columns = createColumns({
    properties: { columnCount: 3 },
    children: ["column-button", "column-label", "column-input"],
  });
  const button = createButton({
    key: "column-button",
    codeName: "saveRecord",
    properties: { label: "Save record", variant: "primary", disabled: false, help: "" },
  });
  const label = createLabel({
    key: "column-label",
    codeName: "statusLabel",
    properties: { text: "Ready <now>", fontSize: "small", bold: false },
  });
  const input = createTextInput({
    key: "column-input",
    codeName: "recordName",
    properties: {
      label: "Record name",
      placeholder: "Name",
      defaultValue: "",
      help: "",
      disabled: false,
      type: "default",
      multiline: false,
      height: "",
    },
  });
  const preview = generator.generate(
    project,
    createDocument([columns, input, label, button]),
  );

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
  const source = preview.files[0]?.content ?? "";
  assert.equal((source.match(/st\.columns\(3\)/g) ?? []).length, 1);
  assert.equal((source.match(/st\.text_input\(/g) ?? []).length, 1);
  assert.ok(source.indexOf("st.button(") < source.indexOf("html.escape(str("));
  assert.ok(source.indexOf("html.escape(str(") < source.indexOf("st.text_input("));
});


test("ProjectPreviewGenerator_ColumnsFillsEmptySlotsWithPlaceholders", () => {
  const generator = new ProjectPreviewGenerator();
  const source = generator.generate(
    project,
    createDocument([createColumns({ properties: { columnCount: 2 } })]),
  ).files[0]?.content ?? "";

  assert.match(source, /vdab_maincolumns = st\.columns\(2\)/);
  assert.match(source, /with vdab_maincolumns\[0\]:\n    st\.text\('Column 1'\)/);
  assert.match(source, /with vdab_maincolumns\[1\]:\n    st\.text\('Column 2'\)/);
});


test("ProjectPreviewGenerator_ColumnsPlacesControlsBeforeEmptySlots", () => {
  const generator = new ProjectPreviewGenerator();
  const columns = createColumns({
    properties: { columnCount: 2 },
    children: ["column-input"],
  });
  const input = createTextInput({ key: "column-input" });
  const source = generator.generate(
    project,
    createDocument([columns, input]),
  ).files[0]?.content ?? "";

  assert.match(source, /with vdab_maincolumns\[0\]:\n\n    _vdab_lbl_/);
  assert.match(source, /with vdab_maincolumns\[1\]:\n    st\.text\('Column 2'\)/);
});


test("ProjectPreviewGenerator_RejectsInvalidColumnsShapeAndTree", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidColumns = [
    createColumns({ properties: { columnCount: 0 } }),
    createColumns({ properties: { columnCount: 1.5 } }),
    createColumns({ properties: { columnCount: 13 } }),
    createColumns({ properties: { columnCount: "two" } }),
    createColumns({ properties: { columnCount: 2, extra: true } }),
    createColumns({ bindings: { volume: "catalog.schema.volume" } }),
    createColumns({ layout: { y: 1 } }),
    createColumns({ schemaVersion: 2 }),
  ];

  for (const component of invalidColumns) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_columns_properties",
    );
  }

  const invalidTrees = [
    [createColumns({ children: ["missing-child"] })],
    [createColumns({ properties: { columnCount: 1 }, children: ["first-input", "second-input"] }), createTextInput({ key: "first-input" }), createTextInput({ key: "second-input" })],
    [createColumns({ children: ["nested-expander"] }), createExpander({ key: "nested-expander" })],
    [createColumns({ children: ["nested-input"] }), createTextInput({ key: "nested-input", children: ["inner-input"] }), createTextInput({ key: "inner-input" })],
  ];

  for (const components of invalidTrees) {
    assert.throws(
      () => generator.generate(project, createDocument(components)),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        (error.code === "invalid_component_tree" || error.code === "invalid_columns_properties"),
    );
  }
});


test("ProjectPreviewGenerator_RowsChildrenMatchOrderedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "./fixtures/contracts/generated/rows-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const rows = createRows({
    properties: { rowCount: 3 },
    children: ["row-button", "row-label", "row-input"],
  });
  const button = createButton({
    key: "row-button",
    codeName: "saveRecord",
    properties: { label: "Save record", variant: "primary", disabled: false, help: "" },
  });
  const label = createLabel({
    key: "row-label",
    codeName: "statusLabel",
    properties: { text: "Ready <now>", fontSize: "small", bold: false },
  });
  const input = createTextInput({
    key: "row-input",
    codeName: "recordName",
    properties: {
      label: "Record name",
      placeholder: "Name",
      defaultValue: "",
      help: "",
      disabled: false,
      type: "default",
      multiline: false,
      height: "",
    },
  });
  const preview = generator.generate(
    project,
    createDocument([rows, input, label, button]),
  );

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
  const source = preview.files[0]?.content ?? "";
  assert.equal((source.match(/st\.container\(\)/g) ?? []).length, 1);
  assert.equal((source.match(/st\.text\('Row /g) ?? []).length, 0);
  assert.ok(source.indexOf("st.button(") < source.indexOf("html.escape(str("));
  assert.ok(source.indexOf("html.escape(str(") < source.indexOf("st.text_input("));
});


test("ProjectPreviewGenerator_RowsUsesValidEmptyAndPartialContainers", () => {
  const generator = new ProjectPreviewGenerator();
  const emptySource = generator.generate(
    project,
    createDocument([createRows()]),
  ).files[0]?.content ?? "";
  const partialRows = createRows({
    properties: { rowCount: 2 },
    children: ["row-input"],
  });
  const partialInput = createTextInput({ key: "row-input" });
  const partialSource = generator.generate(
    project,
    createDocument([partialRows, partialInput]),
  ).files[0]?.content ?? "";

  assert.match(emptySource, /with vdab_mainrows:\n    pass/);
  assert.match(partialSource, /with vdab_mainrows:\n\n    _vdab_lbl_/);
  assert.match(partialSource, /st\.text\('Row 2'\)/);
});


test("ProjectPreviewGenerator_RejectsInvalidRowsShapeAndTree", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidRows = [
    createRows({ properties: { rowCount: 0 } }),
    createRows({ properties: { rowCount: 1.5 } }),
    createRows({ properties: { rowCount: 13 } }),
    createRows({ properties: { rowCount: "two" } }),
    createRows({ properties: { rowCount: 2, extra: true } }),
    createRows({ bindings: { table: "workspace-table" } }),
    createRows({ layout: { y: 1 } }),
    createRows({ schemaVersion: 2 }),
  ];

  for (const component of invalidRows) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_rows_properties",
    );
  }

  const invalidTrees = [
    [createRows({ children: ["missing-child"] })],
    [createRows({ properties: { rowCount: 1 }, children: ["first-input", "second-input"] }), createTextInput({ key: "first-input" }), createTextInput({ key: "second-input" })],
    [createRows({ children: ["nested-columns"] }), createColumns({ key: "nested-columns" })],
    [createRows({ children: ["nested-input"] }), createTextInput({ key: "nested-input", children: ["inner-input"] }), createTextInput({ key: "inner-input" })],
  ];

  for (const components of invalidTrees) {
    assert.throws(
      () => generator.generate(project, createDocument(components)),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        (error.code === "invalid_component_tree" || error.code === "invalid_rows_properties"),
    );
  }
});


test("ProjectPreviewGenerator_TabsChildrenMatchOrderedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "./fixtures/contracts/generated/tabs-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const tabs = createTabs({
    properties: { tabs: ["Overview O'Brien", "Details", "Audit"], defaultTabIndex: 1 },
    children: ["tab-button", "tab-label", "tab-input"],
  });
  const button = createButton({
    key: "tab-button",
    codeName: "saveRecord",
    properties: { label: "Save record", variant: "primary", disabled: false, help: "" },
    layout: { tabIndex: 0, y: 1 },
  });
  const label = createLabel({
    key: "tab-label",
    codeName: "statusLabel",
    properties: { text: "Ready <now>", fontSize: "small", bold: false },
    layout: { tabIndex: 0, y: 0 },
  });
  const input = createTextInput({
    key: "tab-input",
    codeName: "recordName",
    properties: {
      label: "Record name",
      placeholder: "Name",
      defaultValue: "",
      help: "",
      disabled: false,
      type: "default",
      multiline: false,
      height: "",
    },
    layout: { tabIndex: 1, y: 0 },
  });
  const preview = generator.generate(
    project,
    createDocument([tabs, input, button, label]),
  );
  const source = preview.files[0]?.content ?? "";

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
  assert.ok(source.indexOf("html.escape(str(") < source.indexOf("st.button("));
  assert.match(source, /default='Details'/);
  assert.match(source, /st\.text\('Audit'\)/);
});


test("ProjectPreviewGenerator_TabsKeepsEmptyPanesAndDeterministicPositionTies", () => {
  const generator = new ProjectPreviewGenerator();
  const tabs = createTabs({
    properties: { tabs: ["One", "Two"] },
    children: ["second", "first"],
  });
  const second = createTextInput({
    key: "second",
    layout: { tabIndex: 0, y: 0 },
  });
  const first = createButton({
    key: "first",
    layout: { tabIndex: 0, y: 0 },
  });
  const source = generator.generate(
    project,
    createDocument([tabs, second, first]),
  ).files[0]?.content ?? "";

  assert.match(source, /with vdab_maintabs\[0\]:\n\n    _vdab_lbl_vdab_customername/);
  assert.match(source, /with vdab_maintabs\[1\]:\n    st\.text\('Two'\)/);
});
