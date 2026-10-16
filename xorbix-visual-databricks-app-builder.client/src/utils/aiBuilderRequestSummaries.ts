import type {
  CanvasComponentSummary,
  ConversationMessage,
  WorkflowSummary,
} from "../models/AiBuilderModels";
import type { VdabComponent } from "../types/components/vdabComponent";
import type { Workflow } from "../types/workflow/workflowDefinition";

export const AI_BUILDER_MAX_CONVERSATION_MESSAGES = 20;

export const mapComponentsToSummaries = (
  components: VdabComponent[],
): CanvasComponentSummary[] =>
  components.map((component) => ({
    id: component.id,
    type: component.type as string,
    codeName: component.codeName,
    props: component.props,
    children: component.children ?? [],
  }));

export const mapWorkflowsToSummaries = (
  workflows: Workflow[],
): WorkflowSummary[] =>
  workflows.map((workflow) => ({
    codeName: workflow.codeName,
    triggerComponentCodeName: workflow.trigger.componentCodeName,
    triggerEventKey: workflow.trigger.eventKey,
    nodes: workflow.nodes.map((node) => ({
      nodeId: node.id,
      actionType: node.actionType,
      params: node.params,
    })),
    edges: workflow.edges.map((edge) => ({
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      route: edge.route,
    })),
  }));

export const buildConversationHistory = (
  messages: Array<{ sender: "user" | "bot"; text: string }>,
  maxMessages = AI_BUILDER_MAX_CONVERSATION_MESSAGES,
): ConversationMessage[] =>
  messages.slice(-maxMessages).map((message) => ({
    role: message.sender === "user" ? "user" : "assistant",
    content: message.text,
  }));
