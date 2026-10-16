import type { NormalizedAppResource } from "../../../../../models/DatabricksAppModels";
import type { VdabComponent } from "../../../../../types/components";
import type { Workflow, WorkflowNode } from "../../../../../types/workflow";
import type { WorkflowActionDefinition } from "../../registry/actionDefinitionRegistry";

export interface WorkflowActionEditorProps {
  workflowId: string;
  workflow: Workflow;
  node: WorkflowNode;
  components: VdabComponent[];
  /** App Settings resources (Lakebase BuildSql picker, Genie, etc.). */
  normalizedAppResources?: NormalizedAppResource[];
  customModulesCode?: string;
  /** Embedded `prebuilt_modules_library.py` source for Call Prebuilt Module actions. */
  prebuiltModulesLibrarySource?: string;
  workspaceConnectionId?: number;
  actionDefinition?: WorkflowActionDefinition;
  onUpdateNode: (
    workflowId: string,
    nodeId: string,
    updater: (node: WorkflowNode) => WorkflowNode,
  ) => void;
}
