import type { ProjectComponent } from "../db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../db/project-workflow-contract.ts";
import type { WorkspaceAppResource } from "../contracts.ts";
import { projectUsesLakebase } from "./preview-lakebase-helpers.ts";
import { getLakebaseDeploymentRequirements } from "./preview-deployment-lakebase-requirements.ts";
import {
  createSqlWarehouseAppResourceBinding,
  isValidSqlWarehouseId,
} from "../sql-warehouse-app-resource-binding.ts";

/** User scopes and unsupported actions required by one generated Streamlit app. */
export interface ProjectDeploymentRequirements {
  userApiScopes: string[];
  appResources: WorkspaceAppResource[];
  blockers: Array<{ code: string; detail: string }>;
}

/** Derives a least-privilege scope set from the saved component/workflow graph. */
export function getProjectDeploymentRequirements(
  components: ProjectComponent[],
  workflow: ProjectWorkflowDefinition,
  defaultSqlWarehouseId: string | null = null,
): ProjectDeploymentRequirements {
  const userApiScopes = new Set<string>();
  const blockers: ProjectDeploymentRequirements["blockers"] = [];
  const lakebaseRequirements = getLakebaseDeploymentRequirements(
    components,
    workflow,
  );
  blockers.push(...lakebaseRequirements.blockers);
  const usesUnityCatalog =
    components.some(
      (component) =>
        component.bindings !== null &&
        Object.hasOwn(component.bindings, "unityCatalogTable"),
    ) ||
    workflow.workflows.some((definition) =>
      definition.nodes.some(
        (node) =>
          (node.actionType === "buildSql" &&
            node.params.sqlSourceKind === "unityCatalogTable") ||
          (node.actionType === "saveToTable" &&
            isUnityCatalogTable(node.params.targetTable)),
      ),
    );
  const requiresDefaultSqlWarehouse =
    components.some(
      (component) =>
        component.bindings !== null &&
        Object.hasOwn(component.bindings, "unityCatalogTable"),
    ) ||
    workflow.workflows.some((definition) =>
      definition.nodes.some(
        (node) =>
          (node.actionType === "saveToTable" &&
            isUnityCatalogTable(node.params.targetTable)) ||
          (node.actionType === "buildSql" &&
            node.params.sqlSourceKind === "unityCatalogTable" &&
            typeof node.params.sqlWarehouseId !== "string"),
      ),
    );

  if (usesUnityCatalog) userApiScopes.add("sql");
  if (projectUsesLakebase(components, workflow)) userApiScopes.add("postgres");
  if (components.some((component) => component.type === "GenieChat"))
    userApiScopes.add("genie");
  if (components.some((component) => component.type === "ModelChat"))
    userApiScopes.add("model-serving");
  if (components.some((component) => component.type === "FileUpload"))
    userApiScopes.add("files");

  const appResources: WorkspaceAppResource[] = [
    ...lakebaseRequirements.appResources,
  ];
  if (requiresDefaultSqlWarehouse) {
    if (
      !defaultSqlWarehouseId ||
      !isValidSqlWarehouseId(defaultSqlWarehouseId)
    ) {
      blockers.push({
        code: "default_sql_warehouse_unavailable",
        detail:
          "Configure a valid installed-workspace DATABRICKS_SQL_WAREHOUSE_ID for Unity Catalog data access before deploying this child App.",
      });
    } else {
      appResources.push(
        createSqlWarehouseAppResourceBinding(defaultSqlWarehouseId).resource,
      );
    }
  }

  if (
    workflow.workflows.some((definition) =>
      definition.nodes.some((node) => node.actionType === "startDatabricksJob"),
    )
  ) {
    blockers.push({
      code: "jobs_user_authorization_scope_unavailable",
      detail:
        "Databricks documents user-authorized Jobs use, but its current Databricks Apps supported-scope list does not include a Jobs scope. The deployment is blocked to prevent a shared-identity fallback.",
    });
  }

  return {
    userApiScopes: [...userApiScopes].sort(),
    appResources,
    blockers,
  };
}

function isUnityCatalogTable(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "tableType" in value &&
    value.tableType === "unityCatalogTable"
  );
}
