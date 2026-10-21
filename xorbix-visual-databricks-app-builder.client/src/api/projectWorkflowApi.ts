import {
  PROJECT_WORKFLOW_ACTION_TYPES,
  ProjectWorkflowDocument,
  type IProjectWorkflowDefinition,
  type IProjectWorkflowDocument,
  type IProjectWorkflowEdge,
  type IProjectWorkflowNode,
} from "../models/ProjectWorkflow";

const PROJECTS_PATH = "/api/v1/projects";
const WORKFLOW_ROUTES = ["onSuccess", "onError", "always"] as const;

/** Loads the ordered workflow aggregate under the current project's ACL. */
export async function getProjectWorkflow(
  projectId: string,
  signal?: AbortSignal,
): Promise<IProjectWorkflowDocument> {
  const response = await fetch(`${projectPath(projectId)}/workflow`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseWorkflowDocument(await response.json());
}

/** Replaces the workflow aggregate at the shared project version. */
export async function replaceProjectWorkflow(input: {
  projectId: string;
  version: number;
  workflow: IProjectWorkflowDefinition;
}): Promise<IProjectWorkflowDocument> {
  const response = await fetch(`${projectPath(input.projectId)}/workflow`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ version: input.version, workflow: input.workflow }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseWorkflowDocument(await response.json());
}

function projectPath(projectId: string): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(projectId)}`;
}

function parseWorkflowDocument(value: unknown): IProjectWorkflowDocument {
  if (
    !isRecord(value) ||
    typeof value.projectId !== "string" ||
    !isPositiveInteger(value.version)
  ) {
    throw new Error("The project service returned an invalid workflow document.");
  }

  const workflow = parseWorkflowDefinition(value.workflow);
  return new ProjectWorkflowDocument({
    projectId: value.projectId,
    version: value.version,
    workflow,
  });
}

function parseWorkflowDefinition(value: unknown): IProjectWorkflowDefinition {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.workflows)) {
    throw new Error("The project service returned an invalid workflow definition.");
  }

  return {
    version: 1,
    workflows: value.workflows.map(parseWorkflow),
  };
}

function parseWorkflow(value: unknown): IProjectWorkflowDefinition["workflows"][number] {
  if (
    !isRecord(value) ||
    typeof value.codeName !== "string" ||
    !isRecord(value.trigger) ||
    typeof value.trigger.componentKey !== "string" ||
    typeof value.trigger.eventKey !== "string" ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    throw new Error("The project service returned an invalid workflow.");
  }

  return {
    codeName: value.codeName,
    trigger: {
      componentKey: value.trigger.componentKey,
      eventKey: value.trigger.eventKey,
    },
    nodes: value.nodes.map(parseWorkflowNode),
    edges: value.edges.map(parseWorkflowEdge),
  };
}

function parseWorkflowNode(value: unknown): IProjectWorkflowNode {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isProjectWorkflowActionType(value.actionType) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.params)
  ) {
    throw new Error("The project service returned an invalid workflow action.");
  }

  return {
    id: value.id,
    actionType: value.actionType,
    schemaVersion: 1,
    params: value.params,
  };
}

function parseWorkflowEdge(value: unknown): IProjectWorkflowEdge {
  if (
    !isRecord(value) ||
    typeof value.fromNodeId !== "string" ||
    typeof value.toNodeId !== "string" ||
    !isWorkflowRoute(value.route)
  ) {
    throw new Error("The project service returned an invalid workflow route.");
  }

  return {
    fromNodeId: value.fromNodeId,
    toNodeId: value.toNodeId,
    route: value.route,
  };
}

function isProjectWorkflowActionType(value: unknown): value is IProjectWorkflowNode["actionType"] {
  return typeof value === "string" &&
    (PROJECT_WORKFLOW_ACTION_TYPES as readonly string[]).includes(value);
}

function isWorkflowRoute(value: unknown): value is IProjectWorkflowEdge["route"] {
  return typeof value === "string" &&
    (WORKFLOW_ROUTES as readonly string[]).includes(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const responseBody: unknown = await response.json();
    if (isRecord(responseBody) && typeof responseBody.detail === "string") {
      return responseBody.detail;
    }
    if (isRecord(responseBody) && typeof responseBody.title === "string") {
      return responseBody.title;
    }
  } catch {
    // Fall back to the status if a response is not a problem document.
  }

  return `The workflow request failed (HTTP ${response.status}).`;
}
