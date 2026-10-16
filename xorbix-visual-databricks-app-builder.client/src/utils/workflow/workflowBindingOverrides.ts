import {
  isWorkflowActionNode,
  type SetBindingTargetType,
  type WorkflowDefinition,
} from "../../types/workflow";
import {
  buildNodeOptionLabel,
  getSetBindingTargetTypeForComponent,
} from "./actionReferenceOptions";
import type { VdabComponent } from "../../types/components";

export interface WorkflowBindingOverrideSummary {
  workflowCodeName: string;
  nodeId: string;
  nodeLabel: string;
  bindingType: SetBindingTargetType;
  componentCodeName: string;
  sourceNodeId: string;
  outputKey: string;
}

export const getWorkflowBindingOverridesForComponent = (
  workflowDefinition: WorkflowDefinition,
  componentCodeName: string,
  components?: VdabComponent[],
): WorkflowBindingOverrideSummary[] =>
  workflowDefinition.workflows.flatMap((workflow) =>
    workflow.nodes.flatMap((node) => {
      if (!isWorkflowActionNode(node, "SetBinding")) {
        return [];
      }

      if (node.params.target.componentCodeName !== componentCodeName) {
        return [];
      }

      const targetComponent = components?.find(
        (component) => component.codeName === componentCodeName,
      );
      const bindingType =
        getSetBindingTargetTypeForComponent(targetComponent) ??
        node.params.target.bindingType;

      return [
        {
          workflowCodeName: workflow.codeName,
          nodeId: node.id,
          nodeLabel: buildNodeOptionLabel(workflow, node),
          bindingType,
          componentCodeName: node.params.target.componentCodeName,
          sourceNodeId: node.params.source.nodeId,
          outputKey: node.params.source.outputKey,
        },
      ];
    }),
  );
