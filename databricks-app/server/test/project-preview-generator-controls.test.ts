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
