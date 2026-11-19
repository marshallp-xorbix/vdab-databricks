import { ApplicationError } from "./application-error.ts";
import { AiBuilderCanvasSession } from "./ai-builder-canvas-session.ts";
import type {
  AiBuilderEvent,
  AiBuilderInput,
  AiBuilderModelMessage,
  AiBuilderProposal,
  AiBuilderToolCall,
} from "./ai-builder-contract.ts";
import { readAiBuilderInput } from "./ai-builder-input.ts";
import { buildAiBuilderMessages } from "./ai-builder-prompt.ts";
import type { AiBuilderResourceContextService } from "./ai-builder-resource-context.ts";
import { readAiBuilderCompletion } from "./ai-builder-stream.ts";
import { AI_BUILDER_TOOL_NAMES } from "./ai-builder-tool.ts";
import { buildAiBuilderToolProgressMessage } from "./ai-builder-tool-progress.ts";
import type { AiBuilderModelClient } from "./ai-builder-workspace-client.ts";
import type { ComponentRegistryService } from "./component-registry/component-registry-service.ts";
import type { CallerIdentity, WorkspaceServingEndpointResource } from "./contracts.ts";
import { WORKSPACE_CHAT_ENDPOINT_TASK } from "./contracts.ts";
import type { ProjectCustomModulesService } from "./db/project-custom-modules-service.ts";
import type { ProjectComponentsService } from "./db/project-components-service.ts";
import type { ProjectService } from "./db/project-service.ts";
import type { ProjectWorkflowService } from "./db/project-workflow-service.ts";
import type { WorkspaceResourcesService } from "./workspace-resources-service.ts";

const MAX_TOOL_ROUNDS = 12;

export interface PreparedAiBuilderRequest {
  execute(
    signal: AbortSignal,
    emit: (event: AiBuilderEvent) => Promise<void>,
  ): Promise<void>;
}

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
    const messages: AiBuilderModelMessage[] = buildAiBuilderMessages(
      input,
      definitions,
      resourceContext,
    );
    const session = new AiBuilderCanvasSession(input.proposalContext, definitions);
    let latestAssistantMessage = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      await emit({
        event: "progress",
        data: {
          message: round === 0
            ? `Generating a proposal with ${endpoint.name}…`
            : "Continuing the multi-step proposal…",
        },
      });
      const response = await this.workspaceClient.invoke(caller, endpoint.name, messages, signal);
      let progressEvents = Promise.resolve();
      const completion = await readAiBuilderCompletion(response, signal, (message) => {
        progressEvents = progressEvents.then(() => emit({ event: "progress", data: { message } }));
      });
      await progressEvents;
      latestAssistantMessage = completion.assistantMessage.trim() || latestAssistantMessage;

      if (completion.toolCalls.length === 0) {
        await emit({
          event: "result",
          data: await this.finalizeWithoutTools(
            session,
            input,
            definitions,
            latestAssistantMessage,
          ),
        });
        return;
      }

      const toolResults = await this.applyToolCalls(session, completion.toolCalls, emit);
      messages.push({
        role: "assistant",
        content: completion.assistantMessage.trim() || null,
        tool_calls: completion.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: { name: toolCall.name, arguments: toolCall.argumentsJson },
        })),
      });
      for (const result of toolResults) {
        messages.push({
          role: "tool",
          tool_call_id: result.id,
          content: result.content,
        });
      }
    }

    await emit({
      event: "result",
      data: await this.finalizeAfterMaxRounds(session, input, definitions, latestAssistantMessage),
    });
  }

  private async applyToolCalls(
    session: AiBuilderCanvasSession,
    toolCalls: AiBuilderToolCall[],
    emit: (event: AiBuilderEvent) => Promise<void>,
  ): Promise<Array<{ id: string; content: string }>> {
    const results: Array<{ id: string; content: string }> = [];
    for (const toolCall of toolCalls) {
      if (!AI_BUILDER_TOOL_NAMES.has(toolCall.name)) {
        results.push({
          id: toolCall.id,
          content: `ERROR: Unsupported tool "${toolCall.name}". Use one of the registered canvas tools.`,
        });
        continue;
      }
      let args: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(toolCall.argumentsJson || "{}");
        if (!isRecord(parsed)) throw new Error("Tool arguments must be a JSON object.");
        args = parsed;
      } catch (error) {
        results.push({
          id: toolCall.id,
          content: `ERROR: ${error instanceof Error ? error.message : "Invalid tool arguments JSON."}`,
        });
        continue;
      }
      await emit({
        event: "progress",
        data: { message: buildAiBuilderToolProgressMessage(toolCall.name, args) },
      });
      results.push({
        id: toolCall.id,
        content: session.executeTool(toolCall.name, args),
      });
    }
    return results;
  }

  private async finalizeWithoutTools(
    session: AiBuilderCanvasSession,
    input: AiBuilderInput,
    definitions: ReturnType<ComponentRegistryService["getRegistry"]>["components"],
    assistantMessage: string,
  ): Promise<{
    assistantMessage: string;
    proposal: AiBuilderProposal | null;
    version: number;
    outcome: "completed" | "partial" | "needsClarification" | "unableToComplete";
  }> {
    const tagged = readTaggedOutcome(assistantMessage);
    if (!session.hasChanges()) {
      return {
        assistantMessage: assistantMessage.slice(0, 4_000) || "I need more information before making changes.",
        proposal: null,
        version: input.version,
        outcome: tagged === "unableToComplete" ? "unableToComplete" : "needsClarification",
      };
    }
    const outcome = tagged === "partial" || tagged === "unableToComplete" ? tagged : "completed";
    return this.buildValidatedResult(session, input, definitions, assistantMessage, outcome);
  }

  private async finalizeAfterMaxRounds(
    session: AiBuilderCanvasSession,
    input: AiBuilderInput,
    definitions: ReturnType<ComponentRegistryService["getRegistry"]>["components"],
    assistantMessage: string,
  ): Promise<{
    assistantMessage: string;
    proposal: AiBuilderProposal | null;
    version: number;
    outcome: "completed" | "partial" | "needsClarification" | "unableToComplete";
  }> {
    if (!session.hasChanges()) {
      return {
        assistantMessage: [
          assistantMessage || "I could not finish the request within the tool-call limit.",
          "",
          "Try a narrower request, or tell me which part to do first.",
        ].join("\n").slice(0, 4_000),
        proposal: null,
        version: input.version,
        outcome: "unableToComplete",
      };
    }
    return this.buildValidatedResult(session, input, definitions, assistantMessage, "partial");
  }

  private buildValidatedResult(
    session: AiBuilderCanvasSession,
    input: AiBuilderInput,
    definitions: ReturnType<ComponentRegistryService["getRegistry"]>["components"],
    assistantMessage: string,
    preferredOutcome: "completed" | "partial" | "unableToComplete",
  ): {
    assistantMessage: string;
    proposal: AiBuilderProposal | null;
    version: number;
    outcome: "completed" | "partial" | "needsClarification" | "unableToComplete";
  } {
    try {
      const proposal = session.buildProposal(input.version, definitions);
      return {
        assistantMessage: (assistantMessage || "Applied the requested project changes.").slice(0, 4_000),
        proposal,
        version: input.version,
        outcome: preferredOutcome === "unableToComplete" ? "completed" : preferredOutcome,
      };
    } catch (error) {
      const detail = error instanceof ApplicationError
        ? error.message
        : "The proposed project changes could not be validated.";
      return {
        assistantMessage: [
          assistantMessage || "I could not apply a valid set of project changes for that request.",
          "",
          `Validation: ${detail}`,
          "",
          "Try a narrower slice of the request, or tell me which part to do first.",
        ].join("\n").slice(0, 4_000),
        proposal: null,
        version: input.version,
        outcome: "unableToComplete",
      };
    }
  }
}

function requireEditorRole(role: string): void {
  if (role !== "owner" && role !== "editor" && role !== "installationAdmin") {
    throw new ApplicationError(403, "project_edit_permission_required", "Project edit permission required", "Only project editors can request AI Builder changes.");
  }
}

function readTaggedOutcome(
  assistantMessage: string,
): "partial" | "unableToComplete" | "needsClarification" | null {
  const text = assistantMessage.trim();
  if (/^NEEDS_CLARIFICATION:/i.test(text)) return "needsClarification";
  if (/^PARTIAL(?:\[|$)/i.test(text)) return "partial";
  if (/^UNABLE_TO_COMPLETE(?:\[|$)/i.test(text)) return "unableToComplete";
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
