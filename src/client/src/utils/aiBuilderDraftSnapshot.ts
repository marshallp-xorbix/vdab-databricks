import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";

/** Identifies the exact editable draft used by a model suggestion. */
export function createDraftSnapshotKey(
  version: number,
  components: IProjectComponent[],
  workflow: IProjectWorkflowDefinition,
  customModulesSource: string,
): string {
  return JSON.stringify({ version, components, workflow, customModulesSource });
}
