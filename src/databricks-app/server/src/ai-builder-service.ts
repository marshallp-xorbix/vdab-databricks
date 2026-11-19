import { ApplicationError } from "./application-error.ts";
import type { AiBuilderEvent, AiBuilderInput, AiBuilderProposal } from "./ai-builder-contract.ts";
import { readAiBuilderInput } from "./ai-builder-input.ts";
import { applyAiBuilderOperations } from "./ai-builder-operations.ts";
import { buildAiBuilderMessages } from "./ai-builder-prompt.ts";
import { readAiBuilderCompletion } from "./ai-builder-stream.ts";
import { AI_BUILDER_TOOL_NAME } from "./ai-builder-tool.ts";
import type { AiBuilderResourceContextService } from "./ai-builder-resource-context.ts";
import type { ComponentRegistryService } from "./component-registry/component-registry-service.ts";
import type { CallerIdentity, WorkspaceServingEndpointResource } from "./contracts.ts";
import { WORKSPACE_CHAT_ENDPOINT_TASK } from "./contracts.ts";
import type { ProjectService } from "./db/project-service.ts";
import type { ProjectComponentsService } from "./db/project-components-service.ts";
import type { ProjectWorkflowService } from "./db/project-workflow-service.ts";
import type { ProjectCustomModulesService } from "./db/project-custom-modules-service.ts";
import type { WorkspaceResourcesService } from "./workspace-resources-service.ts";
import type { AiBuilderModelClient } from "./ai-builder-workspace-client.ts";

export interface PreparedAiBuilderRequest {
  execute(
    signal: AbortSignal,
    emit: (event: AiBuilderEvent) => Promise<void>,
  ): Promise<void>;
}

type AiBuilderResultData = {
  assistantMessage: string;
  proposal: AiBuilderProposal | null;
  version: number;
  outcome: "completed" | "partial" | "needsClarification" | "unableToComplete";
};

type CompletionParse =
  | { kind: "result"; data: AiBuilderResultData }
  | { kind: "repairable"; assistantMessage: string; detail: string };

/** Validates project and endpoint authority before invoking a customer model. */
export class AiBuilderService {
  private readonly projects: ProjectService;
  private readonly components: ProjectComponentsService;
  private readonly workflows: ProjectWorkflowService;
  private readonly customModules: ProjectCustomModulesService;
  private readonly workspaceResources: WorkspaceResourcesService;
  private readonly componentRegistry: ComponentRegistryService;
  private readonly workspaceClient: AiBuilderModelClient;
  private readonly resourceContext: AiBuilderResourceContextService;

  constructor(
    projects: ProjectService,
    components: ProjectComponentsService,
    workflows: ProjectWorkflowService,
    customModules: ProjectCustomModulesService,
    workspaceResources: WorkspaceResourcesService,
    componentRegistry: ComponentRegistryService,
    workspaceClient: AiBuilderModelClient,
    resourceContext: AiBuilderResourceContextService,
  ) {
    this.projects = projects;
    this.components = components;
    this.workflows = workflows;
    this.customModules = customModules;
    this.workspaceResources = workspaceResources;
    this.componentRegistry = componentRegistry;
    this.workspaceClient = workspaceClient;
    this.resourceContext = resourceContext;
  }

  async prepare(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    body: unknown,
  ): Promise<PreparedAiBuilderRequest> {
    const definitions = this.componentRegistry.getRegistry().components;
    const input = readAiBuilderInput(body, definitions);
    const project = await this.projects.getProject(caller, requestId, projectId);
    requireEditorRole(project.callerRole);
    await this.requireCurrentVersion(caller, requestId, projectId, input.version, project.version);
    const endpoint = await this.requireQueryableEndpoint(caller, input.endpointName);
    return {
      execute: (signal, emit) => this.execute(
        caller,
        endpoint,
        input,
        definitions,
        signal,
        emit,
      ),
    };
  }

  private async requireCurrentVersion(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    expectedVersion: number,
    projectVersion: number,
  ): Promise<void> {
    const [components, workflow, modules] = await Promise.all([
      this.components.getComponents(caller, requestId, projectId),
      this.workflows.getWorkflow(caller, requestId, projectId),
      this.customModules.getCustomModules(caller, requestId, projectId),
    ]);
    if (projectVersion !== expectedVersion || components.version !== expectedVersion ||
        workflow.version !== expectedVersion || modules.version !== expectedVersion) {
      throw new ApplicationError(409, "project_version_conflict", "Project changed", "Reload the latest project before asking AI Builder to propose changes.");
    }
  }

  private async requireQueryableEndpoint(
    caller: CallerIdentity,
    endpointName: string,
  ): Promise<WorkspaceServingEndpointResource> {
    if (caller.authenticationMode === "databricks" && !caller.databricksAccessToken) {
      throw new ApplicationError(401, "databricks_session_required", "Databricks sign-in required", "Open VDAB through Databricks and grant the requested model-serving access.");
    }
    if (caller.authenticationMode !== "databricks" && caller.authenticationMode !== "local-test") {
      throw new ApplicationError(401, "databricks_session_required", "Databricks sign-in required", "Open VDAB through Databricks and grant the requested model-serving access.");
    }
    const endpoints = await this.workspaceResources.listServingEndpoints(caller);
    const endpoint = endpoints.items.find((item) => item.name === endpointName);
    if (endpoint?.task !== undefined && endpoint.task !== WORKSPACE_CHAT_ENDPOINT_TASK) {
      throw new ApplicationError(422, "ai_endpoint_chat_required", "Choose a chat endpoint", "AI Builder needs a chat-completion endpoint with function calling; embedding and completion endpoints cannot build project edits.");
    }
    if (!endpoint || endpoint.readiness !== "ready" ||
        (endpoint.permissionLevel !== "CAN_QUERY" && endpoint.permissionLevel !== "CAN_MANAGE")) {
      throw new ApplicationError(403, "ai_endpoint_not_queryable", "Model endpoint unavailable", "Select a ready serving endpoint that the signed-in user can query in this workspace.");
    }
    return endpoint;
  }

  private async execute(
    caller: CallerIdentity,
    endpoint: WorkspaceServingEndpointResource,
    input: AiBuilderInput,
    definitions: ReturnType<ComponentRegistryService["getRegistry"]>["components"],
    signal: AbortSignal,
    emit: (event: AiBuilderEvent) => Promise<void>,
  ): Promise<void> {
    await emit({ event: "progress", data: { message: "Checking current-workspace resources…" } });
    const resourceContext = await this.resourceContext.getContext(caller, signal);
    const messages = buildAiBuilderMessages(input, definitions, resourceContext);
    const first = await this.completeOnce(
      caller,
      endpoint,
      messages,
      input,
      definitions,
      signal,
      emit,
      `Generating a proposal with ${endpoint.name}…`,
    );
    if (first.kind === "result") {
      await emit({ event: "result", data: first.data });
      return;
    }

    await emit({ event: "progress", data: { message: "Refining the proposal after validation feedback…" } });
    const repairMessages = [
      ...messages,
      {
        role: "assistant" as const,
        content: first.assistantMessage || "I proposed project operations for your request.",
      },
      {
        role: "user" as const,
        content: [
          "The server rejected those project operations:",
          first.detail,
          "Return corrected apply_project_operations with a smaller coherent set of operations, or explain what you need clarified in ordinary assistant text without calling the tool.",
        ].join("\n"),
      },
    ];
    const second = await this.completeOnce(
      caller,
      endpoint,
      repairMessages,
      input,
      definitions,
      signal,
      emit,
      "Generating a revised proposal…",
    );
    if (second.kind === "result") {
      await emit({ event: "result", data: second.data });
      return;
    }
    await emit({
      event: "result",
      data: {
        assistantMessage: buildUnableToCompleteMessage(second.assistantMessage, second.detail),
        proposal: null,
        version: input.version,
        outcome: "unableToComplete",
      },
    });
  }

  private async completeOnce(
    caller: CallerIdentity,
    endpoint: WorkspaceServingEndpointResource,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    input: AiBuilderInput,
    definitions: ReturnType<ComponentRegistryService["getRegistry"]>["components"],
    signal: AbortSignal,
    emit: (event: AiBuilderEvent) => Promise<void>,
    progressMessage: string,
  ): Promise<CompletionParse> {
    await emit({ event: "progress", data: { message: progressMessage } });
    const response = await this.workspaceClient.invoke(caller, endpoint.name, messages, signal);
    let progressEvents = Promise.resolve();
    const completion = await readAiBuilderCompletion(
      response,
      signal,
      (message) => {
        progressEvents = progressEvents.then(() => emit({ event: "progress", data: { message } }));
      },
    );
    await progressEvents;
    return readCompletionResult(completion, input, definitions);
  }
}

function requireEditorRole(role: string): void {
  if (role !== "owner" && role !== "editor" && role !== "installationAdmin") {
    throw new ApplicationError(403, "project_edit_permission_required", "Project edit permission required", "Only project editors can request AI Builder changes.");
  }
}

function readCompletionResult(
  completion: Awaited<ReturnType<typeof readAiBuilderCompletion>>,
  input: AiBuilderInput,
  definitions: ReturnType<ComponentRegistryService["getRegistry"]>["components"],
): CompletionParse {
  if (completion.toolArgumentsJson === null) {
    return {
      kind: "result",
      data: {
        assistantMessage: completion.assistantMessage.slice(0, 4_000),
        proposal: null,
        version: input.version,
        outcome: "needsClarification",
      },
    };
  }
  if (completion.toolName !== AI_BUILDER_TOOL_NAME) {
    return {
      kind: "repairable",
      assistantMessage: completion.assistantMessage,
      detail: "The model called an unsupported tool. It must use apply_project_operations.",
    };
  }

  let argumentsValue: unknown;
  try {
    argumentsValue = JSON.parse(completion.toolArgumentsJson);
  } catch {
    return {
      kind: "repairable",
      assistantMessage: preferredAssistantMessage(completion.assistantMessage, null),
      detail: "The model returned tool arguments that are not valid JSON.",
    };
  }
  if (!isRecord(argumentsValue)) {
    return {
      kind: "repairable",
      assistantMessage: preferredAssistantMessage(completion.assistantMessage, null),
      detail: "The model returned tool arguments that are not a JSON object.",
    };
  }
  const outcome = argumentsValue.outcome === "partial" ? "partial" : "completed";
  if (!hasExactKeys(argumentsValue, argumentsValue.outcome === undefined
        ? ["assistantMessage", "operationsJson"]
        : ["assistantMessage", "operationsJson", "outcome"]) ||
      typeof argumentsValue.assistantMessage !== "string" || argumentsValue.assistantMessage.length > 4_000 ||
      typeof argumentsValue.operationsJson !== "string" ||
      (argumentsValue.outcome !== undefined && argumentsValue.outcome !== "partial" && argumentsValue.outcome !== "completed")) {
    return {
      kind: "repairable",
      assistantMessage: preferredAssistantMessage(
        completion.assistantMessage,
        typeof argumentsValue.assistantMessage === "string" ? argumentsValue.assistantMessage : null,
      ),
      detail: "The model tool call must include assistantMessage and operationsJson, with optional outcome of completed or partial.",
    };
  }

  try {
    return {
      kind: "result",
      data: {
        assistantMessage: preferredAssistantMessage(
          completion.assistantMessage,
          argumentsValue.assistantMessage,
        ),
        proposal: applyAiBuilderOperations(
          input.proposalContext,
          argumentsValue.operationsJson,
          input.version,
          definitions,
        ),
        version: input.version,
        outcome,
      },
    };
  } catch (error) {
    const detail = error instanceof ApplicationError
      ? error.message
      : "The proposed project operations could not be applied.";
    return {
      kind: "repairable",
      assistantMessage: preferredAssistantMessage(
        completion.assistantMessage,
        argumentsValue.assistantMessage,
      ),
      detail,
    };
  }
}

function preferredAssistantMessage(streamed: string, toolMessage: string | null): string {
  const preferred = (toolMessage?.trim() || streamed).trim();
  return preferred.slice(0, 4_000);
}

function buildUnableToCompleteMessage(assistantMessage: string, detail: string): string {
  const summary = assistantMessage.trim();
  const parts = [
    summary.length > 0 ? summary : "I could not apply a valid set of project operations for that request.",
    "",
    `Validation: ${detail}`,
    "",
    "Try a narrower slice of the request, or tell me which part to do first.",
  ];
  return parts.join("\n").slice(0, 4_000);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
