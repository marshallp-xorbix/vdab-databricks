import type { Edge, Node } from "@xyflow/react";
import type { VdabComponent } from "../types/components";
import {
  isWorkflowActionNode,
  type WorkflowDefinition,
} from "../types/workflow";
import { getModalComponents } from "./componentOrganization";
import { postProcessGraphData } from "./graphPorts";
import type { PageNodeData } from "../components/AppBuilderComponents/CustomNodes/PageNode";
import type { ModalNodeData } from "../components/AppBuilderComponents/CustomNodes/ModalNode";
import { BRAND_PRIMARY_DARK, getThemePrimaryHex } from "../constants/authBranding";

export type MainFlowNodeData = PageNodeData | ModalNodeData;

export class MainFlowGenerator {
  generateMainFlow(
    formComponents: VdabComponent[],
    workflowDefinition: WorkflowDefinition,
    onDeleteModal?: (modalId: string) => void,
  ): { nodes: Node<MainFlowNodeData>[]; edges: Edge[] } {
    const pagePrimary = getThemePrimaryHex();
    const nodes: Node<MainFlowNodeData>[] = [
      {
        id: "main-page",
        position: { x: 50, y: 50 },
        data: {
          label: "Main Page",
          type: "page",
          backgroundColor: pagePrimary,
          borderColor: pagePrimary,
          textColor: "white",
        },
        type: "page",
      },
    ];
    const edges: Edge[] = [];
    const modals = getModalComponents(formComponents);

    modals.forEach((modal, index) => {
      nodes.push({
        id: modal.id,
        position: { x: 400, y: 50 + index * 150 },
        data: {
          label: modal.props?.title || modal.codeName,
          title: modal.props?.title || "Modal",
          type: "modal",
          modalId: modal.id,
          onDelete: onDeleteModal,
          backgroundColor: BRAND_PRIMARY_DARK,
          borderColor: BRAND_PRIMARY_DARK,
          textColor: "white",
        },
        type: "modal",
      });
    });

    workflowDefinition.workflows.forEach((workflow, index) => {
      const hasModalAction = workflow.nodes.some(
        (node) =>
          isWorkflowActionNode(node, "ShowModal") &&
          Boolean(node.params.modalCodeName),
      );
      if (!hasModalAction) {
        return;
      }

      workflow.nodes.forEach((node) => {
        if (!isWorkflowActionNode(node, "ShowModal")) {
          return;
        }

        const modal = modals.find(
          (component) => component.codeName === node.params.modalCodeName,
        );
        if (!modal) {
          return;
        }

        edges.push({
          id: `workflow-main-${workflow.codeName}-${modal.id}-${index}`,
          source: "main-page",
          target: modal.id,
          label:
            workflow.codeName?.trim() ||
            `${workflow.trigger.componentCodeName}.${workflow.trigger.eventKey}`,
          type: "smoothstep",
          animated: true,
          style: { stroke: "var(--primary)", strokeWidth: 2 },
        });
      });
    });

    // Apply centralized handle visibility and edge routing logic
    return postProcessGraphData(nodes, edges);
  }
}
