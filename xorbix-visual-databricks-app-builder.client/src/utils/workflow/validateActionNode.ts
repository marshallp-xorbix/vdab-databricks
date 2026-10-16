import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import type { VdabComponent } from "../../types/components";
import type { Workflow, WorkflowNode } from "../../types/workflow";
import {
  validateBuildSqlReferences,
  validateRunSqlReferences,
  validateSaveToTableReferences,
  validateSetBindingReferences,
  validateShowModalReferences,
  validateStartDatabricksJobReferences,
} from "./validateActionReferences";
import { validateCallCustomModuleNode } from "./validateCallCustomModuleParams";
import { validateCallPrebuiltModuleNode } from "./validateCallPrebuiltModuleParams";

export interface WorkflowActionValidationResult {
  errors: string[];
}

export const validateActionNode = (
  workflow: Workflow,
  node: WorkflowNode,
  components: VdabComponent[],
  normalizedAppResources?: NormalizedAppResource[],
  prebuiltModulesLibrarySource?: string,
): WorkflowActionValidationResult => ({
  errors: [
    ...validateBuildSqlReferences(node, components, normalizedAppResources),
    ...validateRunSqlReferences(workflow, node),
    ...validateSetBindingReferences(workflow, node, components),
    ...validateShowModalReferences(node, components),
    ...validateSaveToTableReferences(workflow, node, components),
    ...validateStartDatabricksJobReferences(node),
    ...validateCallCustomModuleNode(node),
    ...validateCallPrebuiltModuleNode(node, prebuiltModulesLibrarySource ?? ""),
  ],
});
