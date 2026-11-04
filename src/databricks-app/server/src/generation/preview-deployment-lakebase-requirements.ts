import type { WorkspaceLakebaseAppResource } from "../contracts.ts";
import type { ProjectComponent } from "../db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../db/project-workflow-contract.ts";
import { isRecord } from "../db/project-component-json.ts";
import {
  createAutoscalingAppResourceBinding,
  createProvisionedAppResourceBinding,
} from "../lakebase-app-resource-binding.ts";

interface LakebaseRequirementResult {
  appResources: WorkspaceLakebaseAppResource[];
  blockers: Array<{ code: string; detail: string }>;
}

interface AutoscalingReference {
  kind: "autoscaling";
  projectId: string;
  branchId: string;
  endpointId: string;
  databaseId: string;
  databaseName: string;
  identity: string;
}

interface ProvisionedReference {
  kind: "provisioned";
  instanceName: string;
  databaseName: string;
  identity: string;
}

type LakebaseReference = AutoscalingReference | ProvisionedReference;

const AUTOSCALING_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const PROVISIONED_INSTANCE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const LAKEBASE_DATABASE_PATTERN = /^[A-Za-z0-9_$-]{1,63}$/;

/** Derives the Lakebase App resources needed by one generated child App. */
export function getLakebaseDeploymentRequirements(
  components: ProjectComponent[],
  workflow: ProjectWorkflowDefinition,
): LakebaseRequirementResult {
  const references: LakebaseReference[] = [];
  const blockers: LakebaseRequirementResult["blockers"] = [];

  for (const component of components) {
    const bindings = component.bindings;
    if (!isRecord(bindings)) continue;
    recordReference(references, blockers, () => readComponentAutoscalingReference(bindings));
    recordReference(references, blockers, () => readComponentProvisionedReference(bindings));
  }

  for (const definition of workflow.workflows) {
    for (const node of definition.nodes) {
      const params = node.params;
      if (node.actionType === "buildSql") {
        recordReference(references, blockers, () => readBuildSqlReference(params));
      } else if (node.actionType === "saveToTable") {
        recordReference(references, blockers, () => readSaveTargetReference(params.targetTable));
      }
    }
  }

  const uniqueReferences = new Map(references.map((reference) => [reference.identity, reference]));
  const appResources = [...uniqueReferences.values()].map(toAppResource);
  return { appResources, blockers };
}

function recordReference(
  references: LakebaseReference[],
  blockers: LakebaseRequirementResult["blockers"],
  readReference: () => LakebaseReference | null,
): void {
  try {
    const reference = readReference();
    if (reference) references.push(reference);
  } catch (error) {
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "lakebase_app_resource_incomplete") {
      throw error;
    }
    const detail = error instanceof Error
      ? error.message
      : "A Lakebase reference must be rebound to a current workspace resource before deployment.";
    if (!blockers.some((blocker) => blocker.code === "lakebase_app_resource_incomplete" && blocker.detail === detail)) {
      blockers.push({ code: "lakebase_app_resource_incomplete", detail });
    }
  }
}

function readComponentAutoscalingReference(
  bindings: Record<string, unknown>,
): AutoscalingReference | null {
  const binding = bindings.lakebaseAutoscaling;
  const source = isRecord(binding) && isRecord(binding.source) ? binding.source : null;
  const resource = source && isRecord(source.resource) ? source.resource : null;
  if (!resource || resource.type !== "lakebaseAutoscaling") return null;
  return readAutoscalingReference(resource, "component");
}

function readComponentProvisionedReference(
  bindings: Record<string, unknown>,
): ProvisionedReference | null {
  const binding = bindings.lakebaseProvisionedDatabase;
  const source = isRecord(binding) && isRecord(binding.source) ? binding.source : null;
  const resource = source && isRecord(source.resource) ? source.resource : null;
  if (!resource || resource.type !== "lakebaseProvisionedDatabase") return null;
  return readProvisionedReference(resource.instanceName, resource.database, "component");
}

function readBuildSqlReference(params: Record<string, unknown>): LakebaseReference | null {
  if (params.sqlSourceKind === "lakebaseAutoscaling") {
    return readAutoscalingReference({
      projectId: params.lakebaseProjectId,
      branchId: params.lakebaseBranchId,
      endpointId: params.lakebaseEndpointId,
      databaseId: params.lakebaseDatabaseId,
      database: params.lakebaseDatabaseName,
    }, "BuildSql workflow");
  }
  if (params.sqlSourceKind === "lakebaseProvisionedDatabase") {
    return readProvisionedReference(
      params.lakebaseInstanceName,
      params.lakebaseDatabaseName,
      "BuildSql workflow",
    );
  }
  return null;
}

function readSaveTargetReference(value: unknown): LakebaseReference | null {
  if (!isRecord(value)) return null;
  if (value.tableType === "lakebaseAutoscaling") {
    return readAutoscalingReference(value, "SaveToTable workflow");
  }
  if (value.tableType === "lakebaseProvisionedDatabase") {
    return readProvisionedReference(value.instanceName, value.database, "SaveToTable workflow");
  }
  return null;
}

function readAutoscalingReference(
  value: Record<string, unknown>,
  source: string,
): AutoscalingReference {
  const projectId = readIdentifier(value.projectId);
  const branchId = readIdentifier(value.branchId);
  const endpointId = readIdentifier(value.endpointId);
  const databaseId = readIdentifier(value.databaseId);
  const databaseName = readDatabaseName(value.database);
  if (!projectId || !branchId || !endpointId || !databaseId || !databaseName) {
    throw lakebaseReferenceIncomplete(source);
  }
  return {
    kind: "autoscaling",
    projectId,
    branchId,
    endpointId,
    databaseId,
    databaseName,
    identity: `${projectId}/${branchId}/${databaseId}/${endpointId}`,
  };
}

function readProvisionedReference(
  rawInstanceName: unknown,
  rawDatabaseName: unknown,
  source: string,
): ProvisionedReference {
  const instanceName = readIdentifier(rawInstanceName);
  const databaseName = readDatabaseName(rawDatabaseName);
  if (!instanceName || !databaseName || !PROVISIONED_INSTANCE_PATTERN.test(instanceName)) {
    throw lakebaseReferenceIncomplete(source);
  }
  return {
    kind: "provisioned",
    instanceName,
    databaseName,
    identity: `${instanceName}/${databaseName}`,
  };
}

function toAppResource(
  reference: LakebaseReference,
): WorkspaceLakebaseAppResource {
  if (reference.kind === "autoscaling") {
    return createAutoscalingAppResourceBinding(reference).resource;
  }
  return createProvisionedAppResourceBinding(reference).resource;
}

function readIdentifier(value: unknown): string | null {
  return typeof value === "string" && !value.startsWith("unresolved_") &&
    AUTOSCALING_REFERENCE_PATTERN.test(value)
    ? value
    : null;
}

function readDatabaseName(value: unknown): string | null {
  return typeof value === "string" && LAKEBASE_DATABASE_PATTERN.test(value)
    ? value
    : null;
}

function lakebaseReferenceIncomplete(source: string): Error {
  return Object.assign(
    new Error(`${source} must be rebound to a current workspace Lakebase database before deployment.`),
    { code: "lakebase_app_resource_incomplete" },
  );
}
