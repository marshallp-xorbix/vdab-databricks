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
  assert.match(source, /Select a complete Unity Catalog or Lakebase table binding and primary key/);
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
