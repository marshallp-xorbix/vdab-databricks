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
  createAutoscalingAppResourceBinding,
  createProvisionedAppResourceBinding,
} from "../src/lakebase-app-resource-binding.ts";
import {
  generateLakebaseProvisionedTestApp,
  generateLakebaseTestApp,
} from "../../scripts/lakebase-test-app.ts";

import { project, createDocument, createTextInput, createButton, createCheckbox, createToggle, createDropdown, createDatePicker, createTimePicker, createSlider, createLabel, createExpander, createColumns, createRows, createTabs, createForm, createModal } from "./project-preview-generator-test-support.ts";
import { createFileUpload, createDataWindow, createEditableDataWindow, createEditableDataWindowBinding, createProvisionedLakebaseBinding, isRecord } from "./project-preview-generator-data-test-support.ts";

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

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
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

test("ProjectPreviewGenerator_DataWindowUsesItsAttachedAutoscalingResource", () => {
  const binding = createAutoscalingAppResourceBinding({
    projectId: "project-one",
    branchId: "branch-one",
    endpointId: "endpoint-one",
    databaseId: "database-one",
  });
  const source = new ProjectPreviewGenerator().generate(
    project,
    createDocument([createDataWindow({
      bindings: {
        lakebaseAutoscaling: {
          bindingType: "lakebaseAutoscaling",
          source: {
            kind: "resource",
            valueType: "table",
            resource: {
              type: "lakebaseAutoscaling",
              projectId: "project-one",
              branchId: "branch-one",
              endpointId: "endpoint-one",
              databaseId: "database-one",
              database: "appdb",
              schema: "public",
              table: "customers",
              columns: [{ name: "id", type: "BIGINT" }],
            },
          },
        },
      },
    })]),
  ).files[0]?.content ?? "";

  assert.match(source, new RegExp(`resource_environment_variable='${binding.environmentVariable}'`));
  assert.match(source, /\/api\/2\.0\/postgres\//);
  assert.match(source, /configured_endpoint != endpoint/);
  assert.doesNotMatch(source, /configured_database != database/);
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

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
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


test("ProjectPreviewGenerator_EditableDataWindowWritesLakebaseRowsThroughViewerScopedTransactions", () => {
  const binding = createProvisionedAppResourceBinding({
    instanceName: "legacy-provisioned",
    databaseName: "appdb",
  });
  const source = new ProjectPreviewGenerator().generate(
    project,
    createDocument([createEditableDataWindow({ bindings: createProvisionedLakebaseBinding("id") })]),
  ).files[0]?.content ?? "";

  assert.match(source, /_vdab_lakebase_provisioned_query_df\('public', 'customers', 50/);
  assert.match(source, /_vdab_lakebase_save_editable_rows\('lakebaseProvisionedDatabase'/);
  assert.match(source, new RegExp(`resource_environment_variable='${binding.environmentVariable}'`));
  assert.match(source, /LOCK TABLE /);
  assert.match(source, /COUNT\(DISTINCT /);
  assert.match(source, /connection\.execute\(.*\*update_values\)/);
  assert.match(source, /VALUES \(' \+ insert_values \+ '\)/);
  assert.match(source, /async with connection\.transaction\(\):/);
  assert.doesNotMatch(source, /DATABRICKS_CLIENT_SECRET|workspaceConnectionId|service principal/i);
});
