import { describe, expect, it } from "vitest";
import type { NormalizedAppResource } from "../../../models/DatabricksAppModels";
import type { VdabComponent } from "../../../types/components";
import { AppResourceKindSlug } from "../../../types/appResourceKinds";
import type { BuildSqlNode } from "../../../types/workflow/actionNode";
import { validateBuildSqlReferences } from "../validateActionReferences";

function buildSqlNode(partial: Partial<BuildSqlNode["params"]>): BuildSqlNode {
  return {
    id: "n1",
    actionType: "BuildSql",
    schemaVersion: 1,
    params: {
      sqlSourceKind: "lakebaseProvisionedDatabase",
      sqlTemplate: "SELECT 1",
      placeholders: [],
      ...partial,
    },
  };
}

describe("validateBuildSqlReferences Lakebase", () => {
  const components: VdabComponent[] = [];

  const provisionedResource: NormalizedAppResource = {
    kind: AppResourceKindSlug.Database,
    name: "db1",
    description: "",
    database: {
      database_name: "appdb",
      instance_name: "instance-a",
      permission: "CAN_CONNECT_AND_CREATE",
    },
  };
  const autoscalingResource: NormalizedAppResource = {
    kind: AppResourceKindSlug.AutoscalingDatabase,
    name: "auto-db",
    description: "",
    database: {
      database_name: "appdb",
      permission: "CAN_CONNECT_AND_CREATE",
    },
  };

  it("requires resource when provisioned Lakebase is selected", () => {
    const node = buildSqlNode({
      lakebaseAppResourceName: undefined,
      lakebaseDatabaseName: undefined,
    });
    const errors = validateBuildSqlReferences(node, components, [
      provisionedResource,
    ]);
    expect(errors.some((e) => e.includes("Select a provisioned"))).toBe(true);
  });

  it("flags unknown resource name against App Settings", () => {
    const node = buildSqlNode({
      lakebaseAppResourceName: "nope",
      lakebaseDatabaseName: "appdb",
    });
    const errors = validateBuildSqlReferences(node, components, [
      provisionedResource,
    ]);
    expect(errors.some((e) => e.includes("not in App Settings"))).toBe(true);
  });

  it("passes when resource and database align", () => {
    const node = buildSqlNode({
      lakebaseAppResourceName: "db1",
      lakebaseDatabaseName: "appdb",
      lakebaseInstanceName: "instance-a",
    });
    const errors = validateBuildSqlReferences(node, components, [
      provisionedResource,
    ]);
    const lakebaseMsgs = errors.filter(
      (e) =>
        e.includes("Lakebase") ||
        e.includes("app resource") ||
        e.includes("database name"),
    );
    expect(lakebaseMsgs).toEqual([]);
  });

  it("requires all installed-workspace Autoscaling identifiers and database metadata", () => {
    const validNode = buildSqlNode({
      sqlSourceKind: "lakebaseAutoscaling",
      lakebaseAppResourceName: "auto-db",
      lakebaseDatabaseName: "appdb",
      lakebaseProjectId: "project-1",
      lakebaseBranchId: "production",
      lakebaseEndpointId: "read-write",
    });
    expect(validateBuildSqlReferences(validNode, components, [autoscalingResource])).toEqual([]);

    const importedNode = buildSqlNode({
      ...validNode.params,
      lakebaseAppResourceName: "unresolved_resource_1",
      lakebaseDatabaseName: "unresolved_resource_1",
      lakebaseProjectId: "unresolved_resource_1",
      lakebaseBranchId: "unresolved_resource_1",
      lakebaseEndpointId: "unresolved_resource_1",
    });
    expect(validateBuildSqlReferences(importedNode, components, [autoscalingResource])
      .some((message) => message.includes("current-workspace Lakebase"))).toBe(true);
  });
});
