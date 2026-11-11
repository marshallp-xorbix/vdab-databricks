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
  availableAppResources: readonly WorkspaceAppResource[] | null = null,
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

  const chatRequirements = resolveChatAppResourceRequirements(
    components,
    availableAppResources,
  );
  blockers.push(...chatRequirements.blockers);

  const appResources: WorkspaceAppResource[] = [
    ...lakebaseRequirements.appResources,
    ...chatRequirements.appResources,
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

  return {
    userApiScopes: [...userApiScopes].sort(),
    appResources,
    blockers,
  };
}

/**
 * Resolves Genie/Model Chat App resource bindings into required deploy resources.
 * When the child App resource list is known, bound keys must already exist there so
 * generated env vars are present after redeploy.
 */
export function resolveChatAppResourceRequirements(
  components: ProjectComponent[],
  availableAppResources: readonly WorkspaceAppResource[] | null,
): Pick<ProjectDeploymentRequirements, "appResources" | "blockers"> {
  const blockers: ProjectDeploymentRequirements["blockers"] = [];
  const appResources: WorkspaceAppResource[] = [];
  const seenNames = new Set<string>();

  for (const component of components) {
    const label = component.codeName || component.key;
    if (component.type === "GenieChat") {
      const selected = readBoundResourceName(
        component.properties.genieSpaceAppResourceName,
      );
      if (!selected) {
        blockers.push({
          code: "genie_chat_unbound",
          detail: `Genie Chat "${label}" is not bound to a Genie space. Open App Settings → Resources, add a Genie space, then select it in the component properties.`,
        });
        continue;
      }
      if (availableAppResources === null) continue;
      const grant = findNamedGenieResource(availableAppResources, selected);
      if (!grant) {
        blockers.push({
          code: "genie_chat_resource_missing",
          detail: `Genie Chat "${label}" references app resource "${selected}", but no genie_space resource with that name exists. Add it under App Settings → Resources, then redeploy.`,
        });
        continue;
      }
      if (!seenNames.has(grant.name)) {
        seenNames.add(grant.name);
        appResources.push(grant);
      }
    }
    if (component.type === "ModelChat") {
      const selected = readBoundResourceName(
        component.properties.servingEndpointAppResourceName,
      );
      if (!selected) {
        blockers.push({
          code: "model_chat_unbound",
          detail: `Model Chat "${label}" is not bound to a serving endpoint. Open App Settings → Resources, add a Serving endpoint with CAN_QUERY permission, then select it in the component properties.`,
        });
        continue;
      }
      if (availableAppResources === null) continue;
      const grant = findNamedServingResource(availableAppResources, selected);
      if (!grant) {
        blockers.push({
          code: "model_chat_resource_missing",
          detail: `Model Chat "${label}" references app resource "${selected}", but no serving_endpoint resource with that name exists. Add it under App Settings → Resources, then redeploy.`,
        });
        continue;
      }
      if (!hasServingQueryPermission(grant)) {
        blockers.push({
          code: "model_chat_resource_permission",
          detail: `Model Chat "${label}" references app resource "${selected}", but that serving_endpoint permission must be CAN_QUERY or CAN_MANAGE.`,
        });
        continue;
      }
      if (!seenNames.has(grant.name)) {
        seenNames.add(grant.name);
        appResources.push(grant);
      }
    }
  }
  return { appResources, blockers };
}

function findNamedGenieResource(
  resources: readonly WorkspaceAppResource[],
  name: string,
): WorkspaceAppResource | undefined {
  const lower = name.toLowerCase();
  return resources.find(
    (resource) =>
      "genie_space" in resource && resource.name.trim().toLowerCase() === lower,
  );
}

function findNamedServingResource(
  resources: readonly WorkspaceAppResource[],
  name: string,
): WorkspaceAppResource | undefined {
  const lower = name.toLowerCase();
  return resources.find(
    (resource) =>
      "serving_endpoint" in resource &&
      resource.name.trim().toLowerCase() === lower,
  );
}

function hasServingQueryPermission(resource: WorkspaceAppResource): boolean {
  return (
    "serving_endpoint" in resource &&
    (resource.serving_endpoint.permission === "CAN_QUERY" ||
      resource.serving_endpoint.permission === "CAN_MANAGE")
  );
}

function readBoundResourceName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
