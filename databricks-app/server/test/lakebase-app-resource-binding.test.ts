import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { addGeneratedAppManifest } from "../src/generated-app-manifest.ts";
import {
  createAutoscalingAppResourceBinding,
  createProvisionedAppResourceBinding,
  lakebaseResourceEnvironmentVariable,
} from "../src/lakebase-app-resource-binding.ts";
import { createSqlWarehouseAppResourceBinding } from "../src/sql-warehouse-app-resource-binding.ts";
import { validateWorkspaceAppResources } from "../src/workspace-app-resource-validation.ts";

const autoscalingTarget = {
  projectId: "project-one",
  branchId: "branch-one",
  endpointId: "endpoint-one",
  databaseId: "database-one",
};

test("LakebaseAppResourceBinding_UsesStableDistinctKeysAndVariables", () => {
  const first = createAutoscalingAppResourceBinding(autoscalingTarget);
  const repeated = createAutoscalingAppResourceBinding(autoscalingTarget);
  const otherDatabase = createAutoscalingAppResourceBinding({
    ...autoscalingTarget,
    databaseId: "database-two",
  });
  const provisioned = createProvisionedAppResourceBinding({
    instanceName: "existing-instance",
    databaseName: "databricks_postgres",
  });
  const warehouse = createSqlWarehouseAppResourceBinding("warehouse-123");
  const repeatedWarehouse =
    createSqlWarehouseAppResourceBinding("warehouse-123");

  assert.deepEqual(repeated, first);
  assert.deepEqual(repeatedWarehouse, warehouse);
  assert.notEqual(otherDatabase.resource.name, first.resource.name);
  assert.notEqual(otherDatabase.environmentVariable, first.environmentVariable);
  assert.match(first.resource.name, /^vdab-pg-[a-f0-9]{16}$/);
  assert.match(
    first.environmentVariable,
    /^VDAB_LAKEBASE_ENDPOINT_[A-F0-9]{16}$/,
  );
  assert.match(provisioned.resource.name, /^vdab-db-[a-f0-9]{16}$/);
  assert.match(
    provisioned.environmentVariable,
    /^VDAB_LAKEBASE_HOST_[A-F0-9]{16}$/,
  );
  assert.equal(
    lakebaseResourceEnvironmentVariable(provisioned.resource),
    provisioned.environmentVariable,
  );
  assert.match(warehouse.resource.name, /^vdab-wh-[a-f0-9]{16}$/);
  assert.equal(warehouse.environmentVariable, "DATABRICKS_SQL_WAREHOUSE_ID");
});

test("GeneratedAppManifest_ReferencesEveryLakebaseResourceByItsValueFromKey", () => {
  const provisioned = createProvisionedAppResourceBinding({
    instanceName: "existing-instance",
    databaseName: "databricks_postgres",
  });
  const autoscaling = createAutoscalingAppResourceBinding(autoscalingTarget);
  const warehouse = createSqlWarehouseAppResourceBinding("warehouse-123");

  const files = addGeneratedAppManifest(
    [{ path: "app.py", content: "import streamlit as st\n" }],
    [warehouse.resource, provisioned.resource, autoscaling.resource],
  );

  assert.equal(files[0]?.path, "app.yaml");
  assert.equal(
    files[0]?.content,
    [
      "command: ['streamlit', 'run', 'app.py']",
      "env:",
      `  - name: ${provisioned.environmentVariable}`,
      `    valueFrom: ${provisioned.resource.name}`,
      `  - name: ${autoscaling.environmentVariable}`,
      `    valueFrom: ${autoscaling.resource.name}`,
      `  - name: ${warehouse.environmentVariable}`,
      `    valueFrom: ${warehouse.resource.name}`,
      "",
    ].join("\n"),
  );
  assert.deepEqual(
    validateWorkspaceAppResources([
      autoscaling.resource,
      provisioned.resource,
      warehouse.resource,
    ]),
    [autoscaling.resource, provisioned.resource, warehouse.resource],
  );
});

test("GeneratedAppManifest_RejectsProjectSuppliedManifest", () => {
  assert.throws(
    () =>
      addGeneratedAppManifest(
        [{ path: "app.yaml", content: "command: unsafe" }],
        [],
      ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "generated_manifest_conflict",
  );
});
