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
import { generateLakebaseTestApp } from "../../scripts/lakebase-test-app.ts";

const project: ProjectSummary = {
  id: "project-preview",
  name: "Preview O'Brien",
  description: null,
  version: 4,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

test("ProjectPreviewGenerator_TextInputMatchesAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const document = createDocument([createTextInput()]);
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/textinput-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");

  const preview = generator.generate(project, document);

  assert.deepEqual(preview, {
    projectId: "project-preview",
    version: 4,
    previewOnly: true,
    files: [{ path: "app.py", content: expectedPython }],
  });
});

test("ProjectPreviewGenerator_ButtonMatchesAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/button-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = generator.generate(project, createDocument([createButton()]));

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
  assert.equal(preview.previewOnly, true);
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

  assert.deepEqual(lakebasePreview.files.map((file) => file.path), ["app.py", "requirements.txt"]);
  assert.equal(lakebasePreview.files[1]?.content, "asyncpg==0.32.0\n");
  assert.match(lakebasePreview.files[0]?.content ?? "", /source_kind='lakebaseAutoscaling'/);
  assert.match(lakebasePreview.files[0]?.content ?? "", /projects\/lakebase-project\/branches\/production\/endpoints\/read-write/);
  assert.deepEqual(unityCatalogPreview.files.map((file) => file.path), ["app.py"]);
  assert.doesNotMatch(unityCatalogPreview.files[0]?.content ?? "", /import asyncpg/);
});

test("ProjectPreviewGenerator_ExecutesLakebaseWorkflowWithViewerScopedPostgresRuntime", () => {
  const preview = generateLakebaseTestApp();
  const pythonExecutable = process.env.VDAB_PYTHON_EXECUTABLE ??
    (process.platform === "win32" ? "python" : "python3");
  const harnessPath = resolve(import.meta.dirname, "../../scripts/smoke-generated-workflow.py");
  const result = spawnSync(pythonExecutable, [harnessPath], {
    input: JSON.stringify({ scenario: "lakebase", files: preview.files }),
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 1_000_000,
  });

  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report: unknown = JSON.parse(result.stdout);
  assert.ok(isRecord(report) && report.event === "generated-workflow-smoke.passed");
  assert.deepEqual(report.checks, [
    "lakebase-postgres-sql-lexer",
    "lakebase-viewer-authorized-read-write",
    "lakebase-identity-and-result-bounds",
  ]);
});

test("ProjectPreviewGenerator_CheckboxMatchesAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/checkbox-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = generator.generate(project, createDocument([createCheckbox()]));

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
});

test("ProjectPreviewGenerator_ToggleMatchesAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/toggle-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = generator.generate(project, createDocument([createToggle()]));

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
});

test("ProjectPreviewGenerator_DropdownsMatchAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/dropdown-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const multiSelect = createDropdown({
    key: "selected-categories",
    codeName: "categories",
    properties: {
      label: "Categories",
      options: [{ value: "1" }, { value: "2" }],
      defaultValue: "2",
      disabled: true,
      help: "Choose one or more.",
      placeholder: "Select categories",
      multiselect: true,
    },
  });
  const preview = generator.generate(
    project,
    createDocument([createDropdown(), multiSelect]),
  );

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
});

test("ProjectPreviewGenerator_DatePickerMatchesAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/datepicker-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = generator.generate(project, createDocument([createDatePicker()]));

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
});

test("ProjectPreviewGenerator_TimePickerMatchesAcceptedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/timepicker-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = generator.generate(project, createDocument([createTimePicker()]));

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
});

test("ProjectPreviewGenerator_RejectsInvalidDatePickerPropertiesAndShape", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidDatePickers: ProjectComponent[] = [
    createDatePicker({ properties: { label: "" } }),
    createDatePicker({ properties: { label: "Date", defaultValue: "2025-02-30" } }),
    createDatePicker({
      properties: { label: "Date", minDate: "2025-02-02", maxDate: "2025-02-01" },
    }),
    createDatePicker({ properties: { label: "Date", format: "DD/MM/YY" } }),
    createDatePicker({ properties: { label: "Date", disabled: "false" } }),
    createDatePicker({ properties: { label: "Date", extra: true } }),
    createDatePicker({ bindings: { table: "workspace-table" } }),
    createDatePicker({ children: ["child-key"] }),
    createDatePicker({ schemaVersion: 2 }),
  ];

  for (const component of invalidDatePickers) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_datepicker_properties",
    );
  }
});

test("ProjectPreviewGenerator_RejectsInvalidTimePickerPropertiesAndShape", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidTimePickers: ProjectComponent[] = [
    createTimePicker({ properties: { label: "", defaultValue: "now" } }),
    createTimePicker({ properties: { label: "Time", defaultValue: "25:30" } }),
    createTimePicker({ properties: { label: "Time", step: 0 } }),
    createTimePicker({ properties: { label: "Time", step: 82_801 } }),
    createTimePicker({ properties: { label: "Time", step: 1.5 } }),
    createTimePicker({ properties: { label: "Time", disabled: "false" } }),
    createTimePicker({ properties: { label: "Time", extra: true } }),
    createTimePicker({ layout: { columns: 2 } }),
    createTimePicker({ schemaVersion: 2 }),
  ];

  for (const component of invalidTimePickers) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_timepicker_properties",
    );
  }
});

test("ProjectPreviewGenerator_EscapesDateAndTimePickerText", () => {
  const generator = new ProjectPreviewGenerator();
  const datePicker = createDatePicker({
    properties: { label: "Launch\n'; raise Exception()", help: "Date 'help'" },
  });
  const timePicker = createTimePicker({
    properties: { label: "Start", defaultValue: "now", help: "Time 'help'" },
  });
  const source = generator.generate(project, createDocument([datePicker, timePicker]))
    .files[0]?.content ?? "";

  assert.match(source, /Launch\\n\\'; raise Exception\(\)/);
  assert.match(source, /help='Date \\'help\\''/);
  assert.match(source, /help='Time \\'help\\''/);
  assert.doesNotMatch(source, /\nraise Exception\(\)/);
});

test("ProjectPreviewGenerator_SlidersMatchAcceptedScalarAndRangePythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/slider-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const rangedSlider = createSlider({
    key: "slider-budget",
    codeName: "budgetRange",
    properties: {
      label: "Budget range",
      minValue: 0,
      maxValue: 100,
      defaultValue: 25,
      upperValue: 75,
      step: 5,
      disabled: true,
      help: "Set the budget range.",
      format: "percent",
      ranged: true,
    },
  });
  const preview = generator.generate(
    project,
    createDocument([createSlider(), rangedSlider]),
  );

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
});

test("ProjectPreviewGenerator_RejectsInvalidSliderPropertiesAndShape", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidSliders: ProjectComponent[] = [
    createSlider({ properties: { label: "" } }),
    createSlider({ properties: { label: "Slider", minValue: 100, maxValue: 0 } }),
    createSlider({ properties: { label: "Slider", defaultValue: 101 } }),
    createSlider({ properties: { label: "Slider", step: 0 } }),
    createSlider({ properties: { label: "Slider", step: 101 } }),
    createSlider({ properties: { label: "Slider", ranged: true, upperValue: null } }),
    createSlider({ properties: { label: "Slider", ranged: true, defaultValue: 75, upperValue: 50 } }),
    createSlider({ properties: { label: "Slider", format: "bad-format" } }),
    createSlider({ properties: { label: "Slider", format: "%.2f\\nraise Exception()" } }),
    createSlider({ properties: { label: "Slider", disabled: "false" } }),
    createSlider({ properties: { label: "Slider", extra: true } }),
    createSlider({ bindings: { table: "workspace-table" } }),
    createSlider({ children: ["child-key"] }),
    createSlider({ schemaVersion: 2 }),
  ];

  for (const component of invalidSliders) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_slider_properties",
    );
  }
});

test("ProjectPreviewGenerator_EscapesSliderTextAndNumbers", () => {
  const generator = new ProjectPreviewGenerator();
  const slider = createSlider({
    properties: {
      label: "Revenue\n'; raise Exception()",
      minValue: -1.5,
      maxValue: 3.5,
      defaultValue: 0.5,
      upperValue: 2.5,
      step: 0.25,
      disabled: false,
      help: "O'Brien's value",
      format: "%.2f",
      ranged: true,
    },
  });
  const source = generator.generate(project, createDocument([slider]))
    .files[0]?.content ?? "";

  assert.match(source, /Revenue\\n\\'; raise Exception\(\)/);
  assert.match(source, /value=\(0\.5, 2\.5\)/);
  assert.match(source, /min_value=-1\.5/);
  assert.match(source, /step=0\.25/);
  assert.match(source, /help='O\\'Brien\\'s value'/);
  assert.doesNotMatch(source, /\nraise Exception\(\)/);
});

test("ProjectPreviewGenerator_LabelMatchesEscapedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/label-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const label = createLabel({
    properties: {
      text: "Revenue <img src=x onerror=alert(1)>",
      fontSize: "large",
      bold: true,
    },
  });
  const preview = generator.generate(project, createDocument([label]));

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
});

test("ProjectPreviewGenerator_RejectsInvalidLabelPropertiesAndShape", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidLabels: ProjectComponent[] = [
    createLabel({ properties: { text: 1 } }),
    createLabel({ properties: { text: "Revenue", fontSize: "huge" } }),
    createLabel({ properties: { text: "Revenue", bold: "false" } }),
    createLabel({ properties: { text: "Revenue", extra: true } }),
    createLabel({ bindings: { table: "workspace-table" } }),
    createLabel({ children: ["child-key"] }),
    createLabel({ layout: { columns: 2 } }),
    createLabel({ schemaVersion: 2 }),
  ];

  for (const component of invalidLabels) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_label_properties",
    );
  }
});

test("ProjectPreviewGenerator_EscapesLabelOverridesAtRuntime", () => {
  const generator = new ProjectPreviewGenerator();
  const label = createLabel({ codeName: " headline ", properties: { text: "Title" } });
  const source = generator.generate(project, createDocument([label])).files[0]?.content ?? "";

  assert.match(source, /ui_overrides\.get\('labels', \{\}\)\.get\('headline', None\)/);
  assert.match(source, /html\.escape\(str\(_vdab_disp_lbl_vdab__headline_\)\)/);
});

test("ProjectPreviewGenerator_ExpanderChildrenMatchOrderedPythonFixture", async () => {
  const generator = new ProjectPreviewGenerator();
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/expander-app.py",
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

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
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
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/columns-app.py",
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

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
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
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/rows-app.py",
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

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
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
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/tabs-app.py",
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

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
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

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
  assert.match(expectedPython, /accept_multiple_files=True/);
  assert.match(expectedPython, /_vdab_upload_to_volume\(/);
  assert.match(expectedPython, /class _VDABNoRedirectHandler\(urllib\.request\.HTTPRedirectHandler\)/);
  assert.match(expectedPython, /_vdab_open_no_redirect\(request\)/);
  assert.doesNotMatch(expectedPython, /urlopen\(request, timeout=30\)/);
  assert.match(expectedPython, /x-forwarded-access-token/);
  assert.match(expectedPython, /two files use the same destination name/);
  assert.doesNotMatch(expectedPython, /caller-token|workspaceConnectionId/i);
});

test("ProjectPreviewGenerator_FileUploadKeepsUnboundFilesInMemory", () => {
  const source = new ProjectPreviewGenerator().generate(
    project,
    createDocument([createFileUpload()]),
  ).files[0]?.content ?? "";

  assert.match(source, /accept_multiple_files=True/);
  assert.match(source, /\(in memory\)/);
  assert.doesNotMatch(source, /_vdab_upload_to_volume\(vdab_bytes/);
});

test("ProjectPreviewGenerator_DataWindowUsesViewerAuthorizedSqlAndRendersTableOptions", () => {
  const source = new ProjectPreviewGenerator().generate(
    project,
    createDocument([createDataWindow()]),
  ).files[0]?.content ?? "";

  assert.match(source, /DATABRICKS_SQL_WAREHOUSE_ID/);
  assert.match(source, /x-forwarded-access-token/);
  assert.match(source, /headers=\{'Authorization': f'Bearer \{user_token\}'/);
  assert.match(source, /'warehouse_id': warehouse_id/);
  assert.match(source, /'on_wait_timeout': 'CONTINUE'/);
  assert.match(source, /api\/2\.0\/sql\/statements/);
  assert.match(source, /_vdab_open_no_redirect\(request\)/);
  assert.match(source, /response\.read\(_VDAB_SQL_MAX_HTTP_RESPONSE_BYTES \+ 1\)/);
  assert.match(source, /_VDAB_SQL_MAX_RESULT_BYTES = 20000000/);
  assert.match(source, /_VDAB_SQL_MAX_RESULT_ROWS = 10000/);
  assert.match(source, /request_body\['row_limit'\] = max_rows if max_rows > 0 else _VDAB_SQL_MAX_RESULT_ROWS/);
  assert.match(source, /request_body\['byte_limit'\] = _VDAB_SQL_MAX_RESULT_BYTES/);
  assert.match(source, /def _vdab_sql_reject_truncated_result\(response_body: dict\[str, object\]\) -> None:/);
  assert.match(source, /_vdab_sql_reject_truncated_result\(chunk_response\)/);
  assert.match(source, /if len\(rows\) \+ len\(data_array\) > row_limit:/);
  assert.match(source, /result_bytes \+= chunk_response_bytes/);
  assert.doesNotMatch(source, /response\.read\(\)/);
  assert.doesNotMatch(source, /urlopen\(request, timeout=30\)/);
  assert.match(source, /\/result\/chunks\//);
  assert.match(source, /next_chunk_index/);
  assert.match(source, /for _chunk_attempt in range\(_VDAB_SQL_MAX_RESULT_CHUNKS\)/);
  assert.match(source, /SQL access denied\. Check the current viewer/);
  assert.match(source, /Databricks SQL API request timed out/);
  assert.match(source, /SQL result contains too many pages/);
  assert.match(source, /value\.replace\('`', '``'\)/);
  assert.match(source, /SELECT \* FROM \{table_reference\}/);
  assert.match(source, /row_limit/);
  assert.match(source, /st\.dataframe\(vdab_datawindow1_data, width=800, height='content', hide_index=True/);
  assert.match(source, /customer name \(STRING\)/);
  assert.doesNotMatch(source, /workspaceConnectionId|caller-token|DATABRICKS_CLIENT_SECRET|EXTERNAL_LINKS/);
});

test("ProjectPreviewGenerator_DataWindowMatchesAcceptedPythonFixture", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/data-window-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = new ProjectPreviewGenerator().generate(
    project,
    createDocument([createDataWindow()]),
  );

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
  assert.doesNotMatch(
    preview.files[0]?.content ?? "",
    /def _vdab_sql_execute|def _vdab_sql_merge_rows/,
  );
});

test("ProjectPreviewGenerator_DataWindowLeavesIncompleteBindingsAsSchemaOnly", () => {
  const source = new ProjectPreviewGenerator().generate(
    project,
    createDocument([createDataWindow({
      bindings: {
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            valueType: "table",
            resource: {
              type: "unityCatalogTable",
              catalog: "main",
              schema: null,
              table: null,
              columns: [{ name: "customer name", type: "STRING" }],
            },
          },
        },
      },
    })]),
  ).files[0]?.content ?? "";

  assert.match(source, /Incomplete table binding/);
  assert.match(source, /pd\.DataFrame\(columns=\['customer name'\]\)/);
  assert.doesNotMatch(source, /_vdab_sql_query_df\('main'/);
});

test("ProjectPreviewGenerator_DataWindowRejectsInvalidValues", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidComponents = [
    createDataWindow({ properties: { label: " " } }),
    createDataWindow({ properties: { maxRows: -1 } }),
    createDataWindow({ properties: { scrollable: "true" } }),
    createDataWindow({ properties: { width: "1920px" } }),
    createDataWindow({ properties: { placeholder: "x".repeat(2_001) } }),
    createDataWindow({ children: ["nested"] }),
    createDataWindow({ bindings: { workspaceHost: "https://outside.invalid" } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_data_window_properties",
    );
  }
});

test("ProjectPreviewGenerator_EditableDataWindowMatchesAcceptedPythonFixture", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/editable-data-window-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = new ProjectPreviewGenerator().generate(
    project,
    createDocument([createEditableDataWindow()]),
  );

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
});

test("ProjectPreviewGenerator_EditableDataWindowUsesViewerAuthorizedAtomicParameterizedMerge", () => {
  const source = new ProjectPreviewGenerator().generate(
    project,
    createDocument([createEditableDataWindow()]),
  ).files[0]?.content ?? "";

  assert.match(source, /st\.data_editor\(/);
  assert.match(source, /_table_num_rows = 'dynamic'/);
  assert.match(source, /num_rows=vdab_editabledatawindow1_table_num_rows/);
  assert.match(source, /_vdab_diff_table\(/);
  assert.match(source, /Primary key values must be unique/);
  assert.match(source, /_vdab_sql_validate_primary_key\(/);
  assert.match(source, /COUNT\(DISTINCT/);
  assert.match(source, /unique and non-null across the whole table/);
  assert.match(source, /_vdab_sql_merge_rows\(/);
  assert.match(source, /from_json\(:changes/);
  assert.match(source, /MERGE INTO/);
  assert.match(source, /WHEN MATCHED AND source\.`__vdab_op` = 'delete' THEN DELETE/);
  assert.match(source, /WHEN NOT MATCHED AND source\.`__vdab_op` = 'upsert' THEN INSERT/);
  assert.match(source, /'parameters': parameters/);
  assert.match(source, /x-forwarded-access-token/);
  assert.match(source, /table MODIFY permission/);
  assert.doesNotMatch(source, /VALUES\s*\(\s*\?/);
  assert.doesNotMatch(source, /DATABRICKS_CLIENT_SECRET|workspaceConnectionId|service principal/i);
});

test("ProjectPreviewGenerator_EditableDataWindowRejectsInvalidMetadataAndPreservesIncompleteBinding", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidComponents = [
    createEditableDataWindow({ properties: { numRows: "many" } }),
    createEditableDataWindow({ properties: { disabled: "yes" } }),
    createEditableDataWindow({ bindings: createEditableDataWindowBinding(null) }),
    createEditableDataWindow({
      bindings: {
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            valueType: "table",
            resource: {
              type: "unityCatalogTable",
              catalog: "main",
              schema: "default",
              table: "customers",
              dataSourceFormat: 7,
              primaryKeyColumn: "customer_id",
              columns: [{ name: "customer_id", type: "BIGINT", dataType: "LONG" }],
            },
          },
        },
      },
    }),
    createEditableDataWindow({
      bindings: {
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            valueType: "table",
            resource: {
              type: "unityCatalogTable",
              catalog: "main",
              schema: "default",
              table: "customers",
              dataSourceFormat: "DELTA",
              primaryKeyColumn: "customer_id",
              columns: [{ name: "customer_id", type: 7, dataType: "LONG" }],
            },
          },
        },
      },
    }),
    createEditableDataWindow({
      bindings: createEditableDataWindowBinding("id", [{ name: "id", type: "STRING", dataType: "STRING); DROP TABLE x" }]),
    }),
    createEditableDataWindow({ bindings: { lakebaseAutoscaling: { bindingType: "lakebaseAutoscaling" } } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) => error instanceof ApplicationError && error.status === 422,
    );
  }

  const source = generator.generate(
    project,
    createDocument([createEditableDataWindow({ bindings: createEditableDataWindowBinding(null, [], false) })]),
  ).files[0]?.content ?? "";
  assert.match(source, /Select a complete Unity Catalog table binding and primary key/);
  assert.match(source, /st\.data_editor\(vdab_editabledatawindow1_table_data, disabled=True, num_rows='fixed'/);
  assert.doesNotMatch(source, /_vdab_sql_query_df\('main'/);

  const nonDeltaSource = generator.generate(
    project,
    createDocument([createEditableDataWindow({
      bindings: createEditableDataWindowBinding(
        null,
        [{ name: "customer_id", type: "BIGINT", dataType: "LONG" }],
        true,
        "PARQUET",
      ),
    })]),
  ).files[0]?.content ?? "";
  assert.match(nonDeltaSource, /Row saves require a Delta table/);
  assert.match(nonDeltaSource, /disabled=True, num_rows='fixed'/);
  assert.doesNotMatch(nonDeltaSource, /st\.button\('Save changes'/);
});

test("ProjectPreviewGenerator_FileUploadRejectsIncompleteOrUnsafeBindings", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidUploads = [
    createFileUpload({ bindings: { databricksVolume: {
      bindingType: "databricksVolume",
      source: {
        kind: "resource",
        valueType: "file",
        resource: {
          type: "databricksVolume",
          catalog: "main",
          schema: null,
          volume: null,
          filePath: "",
        },
      },
    } } }),
    createFileUpload({ bindings: { workspaceHost: "https://outside.invalid" } }),
    createFileUpload({ bindings: { databricksVolume: {
      bindingType: "databricksVolume",
      source: {
        kind: "resource",
        valueType: "file",
        resource: {
          type: "databricksVolume",
          catalog: "main",
          schema: "landing",
          volume: "incoming",
          filePath: "../escape",
        },
      },
    } } }),
    createFileUpload({ layout: { y: -1 } }),
    createFileUpload({ properties: { label: "" } }),
  ];

  for (const component of invalidUploads) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_file_upload_properties",
    );
  }
});

test("ProjectPreviewGenerator_ValidatesDropdownOptionsAndShape", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidDropdowns: ProjectComponent[] = [
    createDropdown({ properties: { label: "", options: [{ value: "one" }] } }),
    createDropdown({ properties: { label: "Pick", options: [] } }),
    createDropdown({ properties: { label: "Pick", options: [{ value: 1 }] } }),
    createDropdown({ properties: { label: "Pick", options: [{ value: "one", id: 1 }] } }),
    createDropdown({ properties: { label: "Pick", options: "one" } }),
    createDropdown({
      properties: {
        label: "Pick",
        options: [{ value: "one" }],
        defaultValue: "missing",
        multiselect: true,
      },
    }),
    createDropdown({ properties: { label: "Pick", options: [{ value: "one" }], extra: true } }),
    createDropdown({ bindings: { table: "workspace-table" } }),
    createDropdown({ children: ["child-key"] }),
    createDropdown({ layout: { columns: 2 } }),
    createDropdown({ schemaVersion: 2 }),
  ];

  for (const component of invalidDropdowns) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_dropdown_properties",
    );
  }
});

test("ProjectPreviewGenerator_UsesFirstDropdownOptionForUnknownSingleDefault", () => {
  const generator = new ProjectPreviewGenerator();
  const component = createDropdown({
    properties: {
      label: "Pick one",
      options: [{ value: "one" }, { value: "two" }],
      defaultValue: "missing",
      multiselect: false,
    },
  });
  const source = generator.generate(project, createDocument([component])).files[0]?.content ?? "";

  assert.match(source, /st\.session_state\['vdab_dropdown1'\] = 'one'/);
  assert.match(source, /st\.selectbox\(/);
});

test("ProjectPreviewGenerator_EscapesDropdownOptionAndText", () => {
  const generator = new ProjectPreviewGenerator();
  const component = createDropdown({
    properties: {
      label: "Choose",
      options: [{ value: "one'; raise Exception()" }],
      defaultValue: "one'; raise Exception()",
      help: "Help\ntext",
      placeholder: "Pick 'one'",
      multiselect: true,
    },
  });
  const source = generator.generate(project, createDocument([component])).files[0]?.content ?? "";

  assert.match(source, /one\\'; raise Exception\(\)/);
  assert.match(source, /placeholder='Pick \\'one\\''/);
  assert.doesNotMatch(source, /\nraise Exception\(\)/);
});

test("ProjectPreviewGenerator_MultilineUsesTextAreaAndHeightWithoutPasswordType", () => {
  const generator = new ProjectPreviewGenerator();
  const component = createTextInput({
    properties: {
      label: "Notes",
      placeholder: "Write a note",
      defaultValue: "Initial text",
      help: "Visible to editors.",
      disabled: true,
      type: "password",
      multiline: true,
      height: "240",
    },
  });

  const preview = generator.generate(project, createDocument([component]));
  const source = preview.files[0]?.content ?? "";

  assert.match(source, /st\.text_area\(/);
  assert.match(source, /height=240,/);
  assert.match(source, /disabled=True,/);
  assert.doesNotMatch(source, /type='password'/);
});

test("ProjectPreviewGenerator_RejectsMalformedPropertiesAndInvalidModelChatEndpoint", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidProperty = createTextInput({
    properties: { label: 23 },
  });

  assert.throws(
    () => generator.generate(project, createDocument([invalidProperty])),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 422 &&
      error.code === "invalid_textinput_properties",
  );

  const invalidModelChat: ProjectComponent = {
    ...createTextInput(),
    type: "ModelChat",
    properties: { servingEndpointName: "../external" },
  };

  assert.throws(
    () => generator.generate(project, createDocument([invalidModelChat])),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 422 &&
      error.code === "invalid_model_chat_properties",
  );
});

test("ProjectPreviewGenerator_RejectsInvalidButtonPropertiesAndShape", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidButtons: ProjectComponent[] = [
    createButton({ properties: { label: "" } }),
    createButton({ properties: { label: "Save", variant: "primary'); import os" } }),
    createButton({ properties: { label: "Save", disabled: "false" } }),
    createButton({ bindings: { table: "workspace-table" } }),
    createButton({ children: ["child-key"] }),
    createButton({ layout: { columns: 2 } }),
    createButton({ schemaVersion: 2 }),
  ];

  for (const component of invalidButtons) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_button_properties",
    );
  }
});

test("ProjectPreviewGenerator_RejectsInvalidCheckboxAndToggleProperties", () => {
  const generator = new ProjectPreviewGenerator();
  const invalidControls: ProjectComponent[] = [
    createCheckbox({ properties: { label: "" } }),
    createCheckbox({ properties: { label: "Approved", defaultChecked: "true" } }),
    createCheckbox({ properties: { label: "Approved", extra: false } }),
    createCheckbox({ bindings: { table: "workspace-table" } }),
    createToggle({ properties: { label: "", defaultValue: false } }),
    createToggle({ properties: { label: "Notifications", defaultValue: 1 } }),
    createToggle({ properties: { label: "Notifications", extra: false } }),
    createToggle({ children: ["child-key"] }),
    createToggle({ schemaVersion: 2 }),
  ];

  for (const component of invalidControls) {
    assert.throws(
      () => generator.generate(project, createDocument([component])),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_boolean_control_properties",
    );
  }
});

test("ProjectPreviewGenerator_EscapesCheckboxLabelText", () => {
  const generator = new ProjectPreviewGenerator();
  const component = createCheckbox({
    properties: { label: "Review\n'; raise Exception()" },
  });
  const source = generator.generate(project, createDocument([component])).files[0]?.content ?? "";

  assert.match(source, /Review\\n\\'; raise Exception\(\)/);
  assert.doesNotMatch(source, /\nraise Exception\(\)/);
});

test("ProjectPreviewGenerator_EscapesTextAndKeepsDistinctPythonNames", () => {
  const generator = new ProjectPreviewGenerator();
  const first = createTextInput({
    codeName: "duplicateName",
    properties: { label: "Name\n'\"; raise Exception()" },
  });
  const second = createTextInput({
    key: "second-input",
    codeName: "duplicateName",
    properties: { label: "Second" },
  });
  const preview = generator.generate(project, createDocument([first, second]));
  const source = preview.files[0]?.content ?? "";

  assert.match(source, /vdab_duplicatename = st\.text_input\(/);
  assert.match(source, /vdab_duplicatename_2 = st\.text_input\(/);
  assert.match(source, /Name\\n\\'\"; raise Exception\(\)/);
  assert.doesNotMatch(source, /\nraise Exception\(\)/);
});

test("ProjectPreviewGenerator_EmitsWorkflowRuntimeCallbacksActionsAndModuleFiles", () => {
  const generator = new ProjectPreviewGenerator();
  const form = createForm({
    key: "order-form",
    codeName: "orderForm",
    children: ["order-name"],
  });
  const modal = createModal({ key: "saved-modal", codeName: "savedModal" });
  const button = createButton({ key: "refresh-button", codeName: "refreshButton" });
  const input = createTextInput({ key: "order-name", codeName: "orderName" });
  const dataWindow = createDataWindow({
    key: "orders-grid",
    codeName: "ordersGrid",
  });
  const customModulesSource = [
    "def normalize_order(ctx):",
    "    ctx.set_label('refreshButton', 'Refreshed')",
    "    return {'ok': True}",
  ].join("\n");
  const workflow: ProjectWorkflowDefinition = {
    version: 1,
    workflows: [
      {
        codeName: "refreshOrders",
        trigger: { componentKey: button.key, eventKey: "onClick" },
        nodes: [
          { id: "toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "Refreshing", duration: { kind: "preset", value: "short" } } },
          { id: "modal", actionType: "showModal", schemaVersion: 1, params: { modalComponentKey: modal.key } },
          { id: "build", actionType: "buildSql", schemaVersion: 1, params: { sqlSourceKind: "unityCatalogTable", sqlTemplate: "SELECT * FROM orders WHERE customer = {customer}", placeholders: [{ token: "customer", componentKey: input.key, valueType: "string", formatHint: "sqlStringLiteral" }], sqlWarehouseId: "warehouse-123", sqlWarehouseName: "Analytics" } },
          { id: "run", actionType: "runSql", schemaVersion: 1, params: { statement: { sourceActionType: "buildSql", nodeId: "build" } } },
          { id: "bind", actionType: "setBinding", schemaVersion: 1, params: { source: { sourceActionType: "runSql", nodeId: "run", outputKey: "rows" }, target: { componentKey: dataWindow.key, bindingType: "unityCatalogTable" } } },
          { id: "job", actionType: "startDatabricksJob", schemaVersion: 1, params: { job: { resourceType: "databricksJob", resourceKey: "12345", jobName: "Refresh orders" } } },
          { id: "custom", actionType: "callCustomModule", schemaVersion: 1, params: { functionName: "normalize_order" } },
          { id: "prebuilt", actionType: "callPrebuiltModule", schemaVersion: 1, params: { functionName: "change_text", namedArguments: { component: "refreshButton", new_label: "Done" } } },
        ],
        edges: [
          { fromNodeId: "toast", toNodeId: "modal", route: "onSuccess" },
          { fromNodeId: "modal", toNodeId: "build", route: "onSuccess" },
          { fromNodeId: "build", toNodeId: "run", route: "onSuccess" },
          { fromNodeId: "run", toNodeId: "bind", route: "onSuccess" },
          { fromNodeId: "bind", toNodeId: "job", route: "onSuccess" },
          { fromNodeId: "job", toNodeId: "custom", route: "onSuccess" },
          { fromNodeId: "custom", toNodeId: "prebuilt", route: "onSuccess" },
        ],
      },
      {
        codeName: "saveOrder",
        trigger: { componentKey: form.key, eventKey: "onSubmit" },
        nodes: [
          { id: "save", actionType: "saveToTable", schemaVersion: 1, params: { sourceFormComponentKey: form.key, targetTable: { tableType: "unityCatalogTable", resourceKey: "orders-table", catalog: "main", schema: "default", table: "orders" }, excludedColumns: [], columnMappings: [{ formChildComponentKey: input.key, targetColumnName: "customer_name" }] } },
        ],
        edges: [],
      },
    ],
  };

  const preview = generator.generate(
    project,
    createDocument([button, input, dataWindow, form, modal]),
    workflow,
    customModulesSource,
  );
  const source = preview.files.find((file) => file.path === "app.py")?.content ?? "";

  assert.deepEqual(preview.files.map((file) => file.path), [
    "app.py",
    "custom_modules.py",
    "prebuilt_modules_library.py",
  ]);
  assert.match(source, /on_click=_vdab_run_component_workflows/);
  assert.match(source, /_vdab_run_component_workflows\('order-form', 'onSubmit'\)/);
  assert.match(source, /_vdab_sql_parameter\(parameter_name, value\)/);
  assert.match(source, /warehouse_id_override=source_output\.get\('sqlWarehouseId'\)/);
  assert.match(source, /sqlWarehouseId': params\.get\('sqlWarehouseId'\)/);
  assert.match(source, /warehouse_id_override or os\.environ\.get\('DATABRICKS_SQL_WAREHOUSE_ID'/);
  assert.match(source, /binding_overrides\[str\(target_code_name\) \+ ':' \+ str\(target\.get\('bindingType'\)\)\]/);
  assert.match(source, /'ordersGrid:unityCatalogTable'/);
  assert.match(source, /_vdab_binding_override_to_dataframe\(_vdab_binding_override_[A-Za-z0-9_]+\)/);
  assert.match(source, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
  assert.match(source, /urllib\.request\.build_opener\(_NoRedirect\)/);
  assert.match(source, /def _vdab_start_databricks_job\(job\):/);
  assert.match(source, /api\/2\.2\/jobs\/run-now/);
  assert.match(source, /'Authorization': 'Bearer ' \+ user_token/);
  assert.match(source, /workspace_host = os\.environ\.get\('DATABRICKS_HOST'/);
  assert.match(source, /job_id > '9223372036854775807'/);
  assert.match(source, /if error\.code in \(401, 403\):/);
  assert.match(source, /import custom_modules/);
  assert.match(source, /import prebuilt_modules_library/);
  assert.doesNotMatch(source, /DATABRICKS_CLIENT_SECRET|DATABRICKS_TOKEN|DATABRICKS_HOST.*params/);
  assert.match(
    preview.files.find((file) => file.path === "custom_modules.py")?.content ?? "",
    /def normalize_order\(ctx\):/,
  );
  assert.match(
    preview.files.find((file) => file.path === "prebuilt_modules_library.py")?.content ?? "",
    /def change_text\(ctx, component, new_label\):/,
  );
});

test("ProjectPreviewGenerator_RejectsMissingWorkflowModuleFunction", () => {
  const generator = new ProjectPreviewGenerator();
  const workflow: ProjectWorkflowDefinition = {
    version: 1,
    workflows: [{
      codeName: "runCustom",
      trigger: { componentKey: "button-save", eventKey: "onClick" },
      nodes: [{
        id: "custom",
        actionType: "callCustomModule",
        schemaVersion: 1,
        params: { functionName: "missing_function" },
      }],
      edges: [],
    }],
  };

  assert.throws(
    () => generator.generate(
      project,
      createDocument([createButton()]),
      workflow,
    ),
    (error: unknown) => error instanceof ApplicationError && error.code === "preview_workflow_module_invalid",
  );
});

function createDocument(components: ProjectComponent[]): ProjectComponentsDocument {
  return {
    projectId: project.id,
    version: project.version,
    components,
  };
}

function createTextInput(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "customer-name",
    type: "TextInput",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "customerName",
    description: null,
    properties: {
      label: "Customer name",
      placeholder: "Enter a name",
      defaultValue: "Ada",
      help: "Shown on the customer record.",
      disabled: false,
      type: "default",
      multiline: false,
      height: "",
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createButton(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "button-save",
    type: "Button",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "button1",
    description: null,
    properties: {
      label: "Save changes",
      variant: "secondary",
      disabled: false,
      help: "Save the current draft.",
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createCheckbox(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "checkbox-approved",
    type: "Checkbox",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "checkbox1",
    description: null,
    properties: {
      label: "Approved",
      defaultChecked: true,
      help: "Mark this record approved.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createToggle(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "toggle-notifications",
    type: "Toggle",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "toggle1",
    description: null,
    properties: {
      label: "Notifications",
      defaultValue: false,
      help: "Send update notifications.",
      disabled: true,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createDropdown(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "dropdown-categories",
    type: "Dropdown",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "dropdown1",
    description: null,
    properties: {
      label: "Select an option",
      options: [{ value: "1" }, { value: "2" }],
      defaultValue: "",
      disabled: false,
      help: "",
      placeholder: "Select an option",
      multiselect: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createDatePicker(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "date-project-launch",
    type: "DatePicker",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "datePicker1",
    description: null,
    properties: {
      label: "Launch date",
      defaultValue: "today",
      minDate: "2025-01-01",
      maxDate: "2025-12-31",
      format: "DD/MM/YYYY",
      help: "Choose a launch date.",
      disabled: true,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createTimePicker(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "time-run-start",
    type: "TimePicker",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "timePicker1",
    description: null,
    properties: {
      label: "Run time",
      defaultValue: "08:30:00",
      step: 300,
      help: "Choose the time for the run.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createSlider(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "slider-completion",
    type: "Slider",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "completion",
    description: null,
    properties: {
      label: "Completion",
      minValue: 0,
      maxValue: 100,
      defaultValue: 50,
      upperValue: 60,
      step: 1,
      disabled: false,
      help: "Choose completion.",
      format: "",
      ranged: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createLabel(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "label-revenue",
    type: "Label",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "revenueLabel",
    description: null,
    properties: {
      text: "Revenue",
      fontSize: "medium",
      bold: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createExpander(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "details-expander",
    type: "Expander",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "detailsSection",
    description: null,
    properties: { sectionTitle: "Section", defaultExpanded: false },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createColumns(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "columns-main",
    type: "Columns",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainColumns",
    description: null,
    properties: { columnCount: 2 },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createRows(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "rows-main",
    type: "Rows",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainRows",
    description: null,
    properties: { rowCount: 2 },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createTabs(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "tabs-main",
    type: "Tabs",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainTabs",
    description: null,
    properties: { tabs: ["Tab 1", "Tab 2"], defaultTabIndex: 0 },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createForm(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "form-main",
    type: "Form",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainForm",
    description: null,
    properties: {
      submitButtonText: "Submit",
      clearOnSubmit: false,
      enterToSubmit: true,
      border: true,
      width: "stretch",
      height: "content",
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createModal(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "modal-main",
    type: "Modal",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainModal",
    description: null,
    properties: {
      title: "My Modal",
      width: null,
      height: null,
      position: "center",
      dismissible: true,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createFileUpload(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "customer-files",
    type: "FileUpload",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "customerFiles",
    description: null,
    properties: { label: "Upload documents" },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createDataWindow(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "datawindow-main",
    type: "DataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "dataWindow1",
    description: null,
    properties: {
      label: "Customer table",
      maxRows: 100,
      scrollable: true,
      placeholder: "(missing)",
      width: 800,
      hideIndex: true,
      height: "content",
    },
    bindings: {
      unityCatalogTable: {
        bindingType: "unityCatalogTable",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "unityCatalogTable",
            catalog: "main",
            schema: "default",
            table: "sales`2026",
            primaryKeyColumn: null,
            columns: [
              { name: "customer name", type: "STRING" },
              { name: "revenue", type: "DECIMAL" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
    ...overrides,
  };
}

function createEditableDataWindow(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "editable-data-window-main",
    type: "EditableDataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "editableDataWindow1",
    description: null,
    properties: {
      label: "Editable customers",
      maxRows: 50,
      scrollable: true,
      placeholder: "No customers",
      disabled: false,
      numRows: "dynamic",
      hideIndex: true,
      width: "stretch",
      height: "content",
    },
    bindings: createEditableDataWindowBinding("customer_id"),
    children: [],
    layout: null,
    ...overrides,
  };
}

function createEditableDataWindowBinding(
  primaryKeyColumn: string | null,
  columns: Array<{ name: string; type: string | null; dataType: string | null }> = [
    { name: "customer_id", type: "BIGINT", dataType: "LONG" },
    { name: "customer name", type: "STRING", dataType: "STRING" },
    { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  ],
  complete = true,
  dataSourceFormat: string | null = "DELTA",
): ProjectComponent["bindings"] {
  return {
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog: "main",
          schema: complete ? "default" : null,
          table: complete ? "customers" : null,
          dataSourceFormat,
          primaryKeyColumn,
          columns,
        },
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
