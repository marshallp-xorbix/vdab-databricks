import type {
  AiBuilderStreamEvent,
  IAiBuilderProblemDetails,
  IAiBuilderProposal,
  IAiBuilderRequest,
  IAiBuilderResult,
} from "../models/AiBuilder";
import {
  AiBuilderProblemDetails,
  AiBuilderProposal,
  AiBuilderRequest,
  AiBuilderResult,
} from "../models/AiBuilder";
import type { IProjectComponent, ProjectJsonObject, ProjectJsonValue } from "../models/ProjectComponents";
import type {
  IProjectWorkflowDefinition,
  IProjectWorkflowEdge,
  IProjectWorkflowNode,
} from "../models/ProjectWorkflow";

const PROJECTS_PATH = "/api/v1/projects";
const MAX_ERROR_BODY_LENGTH = 16_384;

export type AiBuilderProgressHandler = (message: string) => void;

/** Error surfaced for a streamed Problem Details event or HTTP failure. */
export class AiBuilderApiError extends Error {
  readonly problem: IAiBuilderProblemDetails | null;

  constructor(message: string, problem: IAiBuilderProblemDetails | null = null) {
    super(message);
    this.name = "AiBuilderApiError";
    this.problem = problem;
  }
}

/** Streams a customer-endpoint proposal for the specified standalone project. */
export async function generateAiBuilderProposal(
  projectId: string,
  request: IAiBuilderRequest,
  onProgress?: AiBuilderProgressHandler,
  signal?: AbortSignal,
): Promise<IAiBuilderResult> {
  if (!projectId.trim()) {
    throw new Error("A project is required to use AI Builder.");
  }

  const response = await fetch(
    `${PROJECTS_PATH}/${encodeURIComponent(projectId)}/ai-builder`,
    {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(new AiBuilderRequest(request)),
      signal,
    },
  );

  if (!response.ok) {
    throw await readHttpError(response);
  }

  if (!response.body) {
    throw new Error("The AI Builder response stream is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];
  let finalResult: IAiBuilderResult | null = null;

  function resetFrame(): void {
    eventName = "";
    dataLines = [];
  }

  function dispatchFrame(): IAiBuilderResult | null {
    if (dataLines.length === 0) {
      resetFrame();
      return null;
    }

    const event = parseStreamEvent(eventName, dataLines.join("\n"));
    resetFrame();

    if (event.type === "progress") {
      onProgress?.(event.message);
      return null;
    }

    if (event.type === "error") {
      const detail = event.problem.detail || event.problem.title;
      throw new AiBuilderApiError(detail, event.problem);
    }

    return event.result;
  }

  function processLine(line: string): void {
    const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (normalizedLine === "") {
      finalResult = dispatchFrame();
      return;
    }
    if (normalizedLine.startsWith(":")) return;

    const separatorIndex = normalizedLine.indexOf(":");
    const field = separatorIndex < 0
      ? normalizedLine
      : normalizedLine.slice(0, separatorIndex);
    const rawValue = separatorIndex < 0
      ? ""
      : normalizedLine.slice(separatorIndex + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field === "event") {
      eventName = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let lineBreakIndex = buffer.indexOf("\n");
      while (lineBreakIndex >= 0) {
        processLine(buffer.slice(0, lineBreakIndex));
        buffer = buffer.slice(lineBreakIndex + 1);
        if (finalResult) return finalResult;
        lineBreakIndex = buffer.indexOf("\n");
      }

      if (done) {
        if (buffer.length > 0) processLine(buffer);
        if (finalResult) return finalResult;
        finalResult = dispatchFrame();
        if (finalResult) return finalResult;
        break;
      }
    }
  } finally {
    if (finalResult) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  throw new Error("The AI Builder stream ended without a result event.");
}

function parseStreamEvent(eventName: string, payloadText: string): AiBuilderStreamEvent {
  let payload: unknown;
  try {
    payload = JSON.parse(payloadText) as unknown;
  } catch {
    throw new Error("AI Builder returned malformed stream data.");
  }

  if (!isRecord(payload)) {
    throw new Error("AI Builder returned an invalid stream event.");
  }

  const type = eventName || (typeof payload.type === "string" ? payload.type : "");
  if (type === "progress" && typeof payload.message === "string") {
    return { type, message: payload.message };
  }
  if (type === "result") {
    return { type, result: readAiBuilderResult(payload) };
  }
  if (type === "error") {
    return { type, problem: readProblemDetails(payload) };
  }

  throw new Error("AI Builder returned an unsupported stream event.");
}

function readAiBuilderResult(value: Record<string, unknown>): IAiBuilderResult {
  if (
    typeof value.assistantMessage !== "string" ||
    !isPositiveInteger(value.version)
  ) {
    throw new Error("AI Builder returned an invalid result.");
  }

  const proposal = value.proposal === null
    ? null
    : readProposal(value.proposal);

  return new AiBuilderResult({
    assistantMessage: value.assistantMessage,
    proposal,
    version: value.version,
  });
}

function readProposal(value: unknown): IAiBuilderProposal {
  if (
    !isRecord(value) ||
    !Array.isArray(value.components) ||
    typeof value.customModulesSource !== "string"
  ) {
    throw new Error("AI Builder returned an invalid project proposal.");
  }

  return new AiBuilderProposal({
    components: value.components.map(readProjectComponent),
    workflow: readWorkflowDefinition(value.workflow),
    customModulesSource: value.customModulesSource,
  });
}

function readProjectComponent(value: unknown): IProjectComponent {
  if (
    !isRecord(value) ||
    typeof value.key !== "string" ||
    typeof value.type !== "string" ||
    !isPositiveInteger(value.schemaVersion) ||
    !isPositiveInteger(value.componentVersion) ||
    !isNullableString(value.codeName) ||
    !isNullableString(value.description) ||
    !isProjectJsonObject(value.properties) ||
    !(value.bindings === null || isProjectJsonObject(value.bindings)) ||
    !Array.isArray(value.children) ||
    !value.children.every((child) => typeof child === "string") ||
    !(value.layout === null || isProjectJsonObject(value.layout))
  ) {
    throw new Error("AI Builder returned an invalid project component.");
  }

  return {
    key: value.key,
    type: value.type,
    schemaVersion: value.schemaVersion,
    componentVersion: value.componentVersion,
    codeName: value.codeName,
    description: value.description,
    properties: value.properties,
    bindings: value.bindings,
    children: value.children,
    layout: value.layout,
  };
}

function readWorkflowDefinition(value: unknown): IProjectWorkflowDefinition {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.workflows)) {
    throw new Error("AI Builder returned an invalid workflow proposal.");
  }

  return {
    version: 1,
    workflows: value.workflows.map(readWorkflow),
  };
}

function readWorkflow(value: unknown): IProjectWorkflowDefinition["workflows"][number] {
  if (
    !isRecord(value) ||
    typeof value.codeName !== "string" ||
    !isRecord(value.trigger) ||
    typeof value.trigger.componentKey !== "string" ||
    typeof value.trigger.eventKey !== "string" ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    throw new Error("AI Builder returned an invalid workflow.");
  }

  return {
    codeName: value.codeName,
    trigger: {
      componentKey: value.trigger.componentKey,
      eventKey: value.trigger.eventKey,
    },
    nodes: value.nodes.map(readWorkflowNode),
    edges: value.edges.map(readWorkflowEdge),
  };
}

function readWorkflowNode(value: unknown): IProjectWorkflowNode {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isWorkflowActionType(value.actionType) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.params)
  ) {
    throw new Error("AI Builder returned an invalid workflow action.");
  }

  return {
    id: value.id,
    actionType: value.actionType,
    schemaVersion: 1,
    params: value.params,
  };
}

function readWorkflowEdge(value: unknown): IProjectWorkflowEdge {
  if (
    !isRecord(value) ||
    typeof value.fromNodeId !== "string" ||
    typeof value.toNodeId !== "string" ||
    !isWorkflowRoute(value.route)
  ) {
    throw new Error("AI Builder returned an invalid workflow route.");
  }

  return {
    fromNodeId: value.fromNodeId,
    toNodeId: value.toNodeId,
    route: value.route,
  };
}

function readProblemDetails(value: Record<string, unknown>): IAiBuilderProblemDetails {
  if (
    typeof value.title !== "string" ||
    !Number.isInteger(value.status) ||
    (value.status as number) < 400 ||
    (value.status as number) > 599 ||
    typeof value.detail !== "string"
  ) {
    throw new Error("AI Builder returned an invalid Problem Details event.");
  }
  return new AiBuilderProblemDetails({
    title: value.title,
    status: value.status as number,
    detail: value.detail,
  });
}

async function readHttpError(response: Response): Promise<AiBuilderApiError> {
  let bodyText: string;
  try {
    bodyText = (await response.text()).slice(0, MAX_ERROR_BODY_LENGTH);
  } catch {
    return new AiBuilderApiError(`AI Builder request failed (HTTP ${response.status}).`);
  }

  try {
    const payload: unknown = JSON.parse(bodyText);
    if (isRecord(payload)) {
      const problem = readProblemDetails({
        title: payload.title,
        status: payload.status ?? response.status,
        detail: payload.detail ?? payload.title,
      });
      return new AiBuilderApiError(problem.detail || problem.title, problem);
    }
  } catch (error) {
    if (error instanceof AiBuilderApiError) return error;
  }

  return new AiBuilderApiError(`AI Builder request failed (HTTP ${response.status}).`);
}

function isWorkflowActionType(value: unknown): value is IProjectWorkflowNode["actionType"] {
  return typeof value === "string" && [
    "triggerToast",
    "showModal",
    "saveToTable",
    "buildSql",
    "runSql",
    "setBinding",
    "startDatabricksJob",
    "callCustomModule",
    "callPrebuiltModule",
  ].includes(value);
}

function isWorkflowRoute(value: unknown): value is IProjectWorkflowEdge["route"] {
  return value === "onSuccess" || value === "onError" || value === "always";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isProjectJsonObject(value: unknown): value is ProjectJsonObject {
  return isRecord(value) && Object.values(value).every(isProjectJsonValue);
}

function isProjectJsonValue(value: unknown): value is ProjectJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isProjectJsonValue);
  return isProjectJsonObject(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

