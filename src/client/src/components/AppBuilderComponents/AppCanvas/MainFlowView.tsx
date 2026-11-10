/**
 * Main Flow View - React Flow diagram showing pages and modals
 */

import { useState, useMemo, useEffect, useCallback, type FC } from "react";
import {
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from "@xyflow/react";
import type {
  Node,
  Edge,
  NodeMouseHandler,
  NodeChange,
  EdgeChange,
} from "@xyflow/react";
import {
  MainFlowGenerator,
  type MainFlowNodeData,
} from "../../../utils/mainFlowUtils";
import type { VdabComponent } from "../../../types/components";
import type { WorkflowDefinition } from "../../../types/workflow";
import ModalNode from "../CustomNodes/ModalNode";
import PageNode from "../CustomNodes/PageNode";
import DeleteModalDialog from "../DeleteModalDialog";
import { getModalChildComponents } from "../../../utils/componentOrganization";
import { useModalDeletion } from "../../../hooks/useModalDeletion";
import ThemedReactFlow from "./ThemedReactFlow";

const MAIN_FLOW_FIT_VIEW = {
  padding: 0.2,
  maxZoom: 1,
  minZoom: 0.35,
} as const;

interface MainFlowViewProps {
  formComponents: VdabComponent[];
  workflowDefinition: WorkflowDefinition;
  onNodeClick: (nodeId: string, nodeType: "page" | "modal") => void;
  onSelectComponent?: (id: string | null) => void;
  onDeleteModal?: (modalId: string) => void;
}

/** Re-centers the graph when pages or modals are added or removed. */
function FitMainFlowOnStructureChange({
  structureKey,
}: Readonly<{ structureKey: string }>) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void fitView(MAIN_FLOW_FIT_VIEW);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, structureKey]);
  return null;
}

const MainFlowView: FC<MainFlowViewProps> = ({
  formComponents,
  workflowDefinition,
  onNodeClick,
  onSelectComponent,
  onDeleteModal,
}) => {
  const {
    deleteDialogOpen,
    modalToDelete,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
  } = useModalDeletion({
    formComponents,
    getModalChildComponents,
  });

  // Regenerate nodes and edges whenever formComponents change
  const { nodes, edges } = useMemo(() => {
    const generator = new MainFlowGenerator();
    return generator.generateMainFlow(
      formComponents,
      workflowDefinition,
      handleDeleteClick,
    );
  }, [formComponents, workflowDefinition, handleDeleteClick]);

  const [workflowNodes, setWorkflowNodes] =
    useState<Node<MainFlowNodeData>[]>(nodes);
  const [workflowEdges, setWorkflowEdges] = useState<Edge[]>(edges);

  // Update workflow nodes/edges when components change
  useEffect(() => {
    setWorkflowNodes(nodes);
    setWorkflowEdges(edges);
  }, [nodes, edges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    const data = node.data as MainFlowNodeData;

    if (node.id === "main-page") {
      onSelectComponent?.(null);
      return;
    }

    if (data.type === "modal" && data.modalId) {
      onSelectComponent?.(data.modalId);
    }
  };

  const handleNodeDoubleClick: NodeMouseHandler = (_event, node) => {
    const data = node.data as MainFlowNodeData;

    if (node.id === "main-page") {
      onNodeClick("main-page", "page");
      return;
    }

    if (data.type === "modal" && data.modalId) {
      onNodeClick(data.modalId, "modal");
    }
  };

  const handleNodesChange = (changes: NodeChange<Node<MainFlowNodeData>>[]) => {
    setWorkflowNodes(
      (currentNodes) =>
        applyNodeChanges(changes, currentNodes) as Node<MainFlowNodeData>[],
    );
  };

  const handleEdgesChange = (changes: EdgeChange<Edge>[]) => {
    setWorkflowEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  };

  const handleConfirmDeleteAndRemove = useCallback(() => {
    const modalId = handleConfirmDelete();
    if (modalId && onDeleteModal) {
      onDeleteModal(modalId);
    }
  }, [handleConfirmDelete, onDeleteModal]);

  const nodeTypes = useMemo(
    () => ({
      page: PageNode,
      modal: ModalNode,
    }),
    [],
  );

  const structureKey = useMemo(
    () => workflowNodes.map((node) => node.id).join("|"),
    [workflowNodes],
  );

  return (
    <>
      <ThemedReactFlow
        className="border-t border-[var(--builder-chrome-border)]"
        gridPreset="mainFlow"
        showMiniMap
        nodes={workflowNodes}
        edges={workflowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={MAIN_FLOW_FIT_VIEW}
        minZoom={MAIN_FLOW_FIT_VIEW.minZoom}
        maxZoom={MAIN_FLOW_FIT_VIEW.maxZoom}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <FitMainFlowOnStructureChange structureKey={structureKey} />
      </ThemedReactFlow>

      {/* Delete confirmation dialog */}
      {modalToDelete && (
        <DeleteModalDialog
          isOpen={deleteDialogOpen}
          modalName={modalToDelete.name}
          componentCount={modalToDelete.componentCount}
          onConfirm={handleConfirmDeleteAndRemove}
          onCancel={handleCancelDelete}
        />
      )}
    </>
  );
};

export default MainFlowView;
