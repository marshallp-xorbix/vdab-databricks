import type { WorkflowSqlSourceKind } from "../../../../../types/workflow";

export const SQL_SOURCE_OPTIONS: Array<{
  value: WorkflowSqlSourceKind;
  label: string;
  helperText: string;
}> = [
  {
    value: "unityCatalogTable",
    label: "Unity Catalog",
    helperText:
      "RunSql uses the signed-in viewer’s SQL permissions in this workspace. Prefer escaped placeholders over raw.",
  },
  {
    value: "lakebaseProvisionedDatabase",
    label: "Lakebase",
    helperText:
      "Select a current-workspace Provisioned instance and an attached database resource. RunSql uses the viewer’s Lakebase permissions.",
  },
  {
    value: "lakebaseAutoscaling",
    label: "Lakebase Autoscaling",
    helperText:
      "Pick an autoscaling Lakebase app resource. RunSql resolves the endpoint and connects to the selected database.",
  },
];

/** Returns whether a source switch crosses the Lakebase connection family. */
export function lakebaseSourceFamily(
  kind: WorkflowSqlSourceKind,
): "unity" | "provisioned" | "autoscaling" {
  if (kind === "unityCatalogTable") {
    return "unity";
  }
  if (kind === "lakebaseProvisionedDatabase") {
    return "provisioned";
  }
  return "autoscaling";
}

/** Identifies resource placeholders imported from another workspace. */
export function isUnresolvedResource(value: string | undefined): boolean {
  return value?.startsWith("unresolved_resource_") ?? false;
}
