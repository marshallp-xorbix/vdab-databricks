import { isWorkflowActionNode } from "../../types/workflow";
import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import type { VdabComponent } from "../../types/components";
import type { Workflow, WorkflowNode } from "../../types/workflow";
import type { WorkflowSqlSourceKind } from "../../types/workflow";
import { AppResourceKindSlug } from "../../types/appResourceKinds";
import {
  getGraphReachablePriorNodeOptions,
  getModalOptions,
  getSaveToTableSourceComponentOptions,
  getSetBindingTargetComponentOptions,
  getSetBindingTargetTypeForComponent,
  getWorkflowTriggerComponent,
  isWorkflowTriggerForm,
} from "./actionReferenceOptions";
import { getInvalidBuildSqlTokens } from "./buildSqlTemplateUtils";

export const validateBuildSqlReferences = (
  node: WorkflowNode,
  components: VdabComponent[],
  normalizedAppResources?: NormalizedAppResource[],
): string[] => {
  if (!isWorkflowActionNode(node, "BuildSql")) {
    return [];
  }

  const errors: string[] = [];
  const validSourceKinds = new Set<WorkflowSqlSourceKind>([
    "unityCatalogTable",
    "lakebaseProvisionedDatabase",
    "lakebaseAutoscaling",
  ]);

  if (!node.params.sqlSourceKind) {
    errors.push("Select whether this SQL targets Unity Catalog or Lakebase.");
  } else if (!validSourceKinds.has(node.params.sqlSourceKind)) {
    errors.push("The selected SQL source is not supported.");
  }

  if (node.params.sqlSourceKind === "lakebaseProvisionedDatabase") {
    if (normalizedAppResources !== undefined) {
      const attached = normalizedAppResources.filter(
        (r) => r.kind === AppResourceKindSlug.Database,
      );
      if (attached.length === 0) {
        errors.push(
          "No provisioned Lakebase resources are attached to this app. Add one in App Settings > Resources.",
        );
      }
    }
    if (!node.params.lakebaseAppResourceName?.trim()) {
      errors.push("Select a provisioned Lakebase app resource for this SQL.");
    }
    if (!node.params.lakebaseDatabaseName?.trim()) {
      errors.push(
        "The selected Lakebase resource must include a database name.",
      );
    }
    if (normalizedAppResources && node.params.lakebaseAppResourceName?.trim()) {
      const name = node.params.lakebaseAppResourceName.trim();
      const match = normalizedAppResources.find(
        (r) => r.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!match) {
        errors.push(
          `App resource '${name}' is not in App Settings. Pick an attached resource or update App Settings.`,
        );
      } else if (match.kind !== AppResourceKindSlug.Database) {
        errors.push(
          `App resource '${name}' is not a provisioned Lakebase database resource.`,
        );
      } else if (
        match.database?.database_name?.trim() &&
        match.database.database_name.trim().toLowerCase() !==
          node.params.lakebaseDatabaseName?.trim().toLowerCase()
      ) {
        errors.push(
          `Database name does not match resource '${name}' (expected '${match.database.database_name.trim()}').`,
        );
      }
    }
  }

  if (node.params.sqlSourceKind === "lakebaseAutoscaling") {
    if (normalizedAppResources !== undefined) {
      const attached = normalizedAppResources.filter(
        (r) => r.kind === AppResourceKindSlug.AutoscalingDatabase,
      );
      if (attached.length === 0) {
        errors.push(
          "No Lakebase Autoscaling resources are attached to this app. Add one in App Settings > Resources.",
        );
      }
    }
    if (!node.params.lakebaseAppResourceName?.trim()) {
      errors.push(
        "Select a Lakebase Autoscaling app resource for this SQL.",
      );
    }
    if (!node.params.lakebaseDatabaseName?.trim()) {
      errors.push(
        "The selected Lakebase Autoscaling resource must include a database name.",
      );
    }
    if (normalizedAppResources && node.params.lakebaseAppResourceName?.trim()) {
      const name = node.params.lakebaseAppResourceName.trim();
      const match = normalizedAppResources.find(
        (r) => r.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!match) {
        errors.push(
          `App resource '${name}' is not in App Settings. Pick an attached resource or update App Settings.`,
        );
      } else if (match.kind !== AppResourceKindSlug.AutoscalingDatabase) {
        errors.push(
          `App resource '${name}' is not a Lakebase Autoscaling database resource.`,
        );
      } else if (
        match.database?.database_name?.trim() &&
        match.database.database_name.trim().toLowerCase() !==
          node.params.lakebaseDatabaseName?.trim().toLowerCase()
      ) {
        errors.push(
          `Database name does not match resource '${name}' (expected '${match.database.database_name.trim()}').`,
        );
      }
    }
  }

  if (node.params.sqlSourceKind === "unityCatalogTable") {
    if (node.params.lakebaseAppResourceName?.trim()) {
      errors.push(
        "Remove the Lakebase app resource selection when using Unity Catalog as the SQL source.",
      );
    }
    if (node.params.lakebaseDatabaseName?.trim()) {
      errors.push(
        "Remove the Lakebase database name when using Unity Catalog as the SQL source.",
      );
    }
  }

  const invalidTokens = getInvalidBuildSqlTokens(
    node.params.sqlTemplate,
    components,
  );

  if (invalidTokens.length > 0) {
    errors.push(
      `Unknown SQL placeholder tokens: ${invalidTokens
        .map((token) => `{${token}}`)
        .join(", ")}.`,
    );
  }

  return errors;
};

export const validateRunSqlReferences = (
  workflow: Workflow,
  node: WorkflowNode,
): string[] => {
  if (!isWorkflowActionNode(node, "RunSql")) {
    return [];
  }

  const validNodeIds = new Set(
    getGraphReachablePriorNodeOptions(workflow, node.id, ["BuildSql"]).map(
      (option) => option.value,
    ),
  );

  if (!node.params.statement.nodeId) {
    return ["Select a prior BuildSql action to execute."];
  }

  return validNodeIds.has(node.params.statement.nodeId)
    ? []
    : [
        "The selected BuildSql action is not graph-reachable from this RunSql node.",
      ];
};

export const validateSetBindingReferences = (
  workflow: Workflow,
  node: WorkflowNode,
  components: VdabComponent[],
): string[] => {
  if (!isWorkflowActionNode(node, "SetBinding")) {
    return [];
  }

  const errors: string[] = [];
  const validSourceNodeIds = new Set(
    getGraphReachablePriorNodeOptions(workflow, node.id, ["RunSql"]).map(
      (option) => option.value,
    ),
  );
  const validTargetComponentCodes = new Set(
    getSetBindingTargetComponentOptions(components).map(
      (option) => option.value,
    ),
  );
  const targetComponent = components.find(
    (component) => component.codeName === node.params.target.componentCodeName,
  );
  const inferredBindingType =
    getSetBindingTargetTypeForComponent(targetComponent);

  if (!node.params.source.nodeId) {
    errors.push("Select a prior RunSql action as the binding source.");
  } else if (!validSourceNodeIds.has(node.params.source.nodeId)) {
    errors.push(
      "The selected RunSql action is not graph-reachable from this SetBinding node.",
    );
  }

  if (!node.params.target.componentCodeName) {
    errors.push("Select a target component for the workflow binding.");
  } else if (
    !validTargetComponentCodes.has(node.params.target.componentCodeName)
  ) {
    errors.push(
      "The selected target component does not support workflow SQL-statement bindings.",
    );
  }

  if (!inferredBindingType && node.params.target.componentCodeName) {
    errors.push(
      "The selected target component does not support workflow data bindings.",
    );
  }

  if (!node.params.target.bindingType) {
    errors.push(
      "The workflow binding target is missing its serialized binding type.",
    );
  } else if (
    inferredBindingType &&
    node.params.target.bindingType !== inferredBindingType
  ) {
    errors.push(
      "The serialized binding type does not match the workflow target expected for this component.",
    );
  }

  return errors;
};

export const validateShowModalReferences = (
  node: WorkflowNode,
  components: VdabComponent[],
): string[] => {
  if (!isWorkflowActionNode(node, "ShowModal")) {
    return [];
  }

  const validModalCodeNames = new Set(
    getModalOptions(components).map((option) => option.value),
  );

  if (!node.params.modalCodeName) {
    return ["Select a modal to show."];
  }

  return validModalCodeNames.has(node.params.modalCodeName)
    ? []
    : ["The selected modal no longer exists."];
};

export const validateSaveToTableReferences = (
  workflow: Workflow,
  node: WorkflowNode,
  components: VdabComponent[],
): string[] => {
  if (!isWorkflowActionNode(node, "SaveToTable")) {
    return [];
  }

  const errors: string[] = [];
  const triggerComponent = getWorkflowTriggerComponent(workflow, components);
  const validSourceComponentCodes = new Set(
    getSaveToTableSourceComponentOptions(workflow, components).map(
      (option) => option.value,
    ),
  );

  if (!isWorkflowTriggerForm(workflow, components)) {
    errors.push(
      "SaveToTable is only available when the workflow trigger component is a form.",
    );
  }

  if (
    triggerComponent?.codeName &&
    node.params.sourceFormComponentCodeName !== triggerComponent.codeName
  ) {
    errors.push(
      "SaveToTable must use the workflow trigger form as its source form.",
    );
  }

  if (node.params.targetTable.workspaceConnectionId <= 0) {
    errors.push("SaveToTable requires a workspace connection.");
  }

  if (node.params.targetTable.tableType === "unityCatalogTable") {
    if (
      !node.params.targetTable.catalog ||
      !node.params.targetTable.schema ||
      !node.params.targetTable.table
    ) {
      errors.push(
        "Select a Unity Catalog catalog, schema, and table for SaveToTable.",
      );
    }
  }

  if (node.params.targetTable.tableType === "lakebaseProvisionedDatabase") {
    if (
      !node.params.targetTable.instanceName ||
      !node.params.targetTable.database ||
      !node.params.targetTable.catalog ||
      !node.params.targetTable.schema ||
      !node.params.targetTable.table
    ) {
      errors.push(
        "Select a Lakebase instance, synced catalog, schema, and table for SaveToTable.",
      );
    }
  }

  if (node.params.targetTable.tableType === "lakebaseAutoscaling") {
    if (
      !node.params.targetTable.projectId ||
      !node.params.targetTable.branchId ||
      !node.params.targetTable.endpointId ||
      !node.params.targetTable.database ||
      !node.params.targetTable.catalog ||
      !node.params.targetTable.schema ||
      !node.params.targetTable.table
    ) {
      errors.push(
        "Select a Lakebase Autoscaling project, branch, endpoint, and synced catalog, schema, and table for SaveToTable.",
      );
    }
  }

  for (const mapping of node.params.columnMappings) {
    if (!validSourceComponentCodes.has(mapping.formChildComponentCodeName)) {
      errors.push(
        `Mapped source component '${mapping.formChildComponentCodeName}' is no longer a valid descendant form field.`,
      );
    }
  }

  return errors;
};

export const validateStartDatabricksJobReferences = (
  node: WorkflowNode,
): string[] => {
  if (!isWorkflowActionNode(node, "StartDatabricksJob")) {
    return [];
  }

  if (!node.params.job.jobId) {
    return ["Select a Databricks job to start."];
  }

  return [];
};
