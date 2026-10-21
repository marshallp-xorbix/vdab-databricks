import { ApplicationError } from "./application-error.ts";
import type { AiBuilderEvent, AiBuilderInput } from "./ai-builder-contract.ts";
import { readAiBuilderInput } from "./ai-builder-input.ts";
import { applyAiBuilderOperations } from "./ai-builder-operations.ts";
import { buildAiBuilderMessages } from "./ai-builder-prompt.ts";
import { readAiBuilderCompletion } from "./ai-builder-stream.ts";
import { AI_BUILDER_TOOL_NAME } from "./ai-builder-tool.ts";
import type { AiBuilderResourceContextService } from "./ai-builder-resource-context.ts";
import type { ComponentRegistryService } from "./component-registry/component-registry-service.ts";
import type { CallerIdentity, WorkspaceServingEndpointResource } from "./contracts.ts";
import type { ProjectService } from "./db/project-service.ts";
import type { ProjectComponentsService } from "./db/project-components-service.ts";
import type { ProjectWorkflowService } from "./db/project-workflow-service.ts";
import type { ProjectCustomModulesService } from "./db/project-custom-modules-service.ts";
import type { WorkspaceResourcesService } from "./workspace-resources-service.ts";
import { AiBuilderWorkspaceClient } from "./ai-builder-workspace-client.ts";

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
  private readonly workspaceClient: AiBuilderWorkspaceClient;
  private readonly resourceContext: AiBuilderResourceContextService;

  constructor(
    projects: ProjectService,
    components: ProjectComponentsService,
    workflows: ProjectWorkflowService,
    customModules: ProjectCustomModulesService,
    workspaceResources: WorkspaceResourcesService,
    componentRegistry: ComponentRegistryService,
    workspaceClient: AiBuilderWorkspaceClient,
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
    if (caller.authenticationMode !== "databricks" || !caller.databricksAccessToken) {
      throw new ApplicationError(401, "databricks_session_required", "Databricks sign-in required", "Open VDAB through Databricks and grant the requested model-serving access.");
    }
    const endpoints = await this.workspaceResources.listServingEndpoints(caller);
    const endpoint = endpoints.items.find((item) => item.name === endpointName);
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
    await emit({ event: "progress", data: { message: `Generating a proposal with ${endpoint.name}…` } });
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
    const result = readCompletionResult(completion, input, definitions);
    await emit({ event: "result", data: result });
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
): { assistantMessage: string; proposal: AiBuilderInput["proposalContext"] | null; version: number } {
  if (completion.toolArgumentsJson === null) {
    return {
      assistantMessage: completion.assistantMessage.slice(0, 4_000),
      proposal: null,
      version: input.version,
    };
  }
  if (completion.toolName !== AI_BUILDER_TOOL_NAME) throw invalidToolProposal();

  let argumentsValue: unknown;
  try {
    argumentsValue = JSON.parse(completion.toolArgumentsJson);
  } catch {
    throw invalidToolProposal();
  }
  if (!isRecord(argumentsValue) || !hasExactKeys(argumentsValue, ["assistantMessage", "operationsJson"]) ||
      typeof argumentsValue.assistantMessage !== "string" || argumentsValue.assistantMessage.length > 4_000 ||
      typeof argumentsValue.operationsJson !== "string") {
    throw invalidToolProposal();
  }

  return {
    assistantMessage: argumentsValue.assistantMessage,
    proposal: applyAiBuilderOperations(
      input.proposalContext,
      argumentsValue.operationsJson,
      input.version,
      definitions,
    ),
    version: input.version,
  };
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidToolProposal(): ApplicationError {
  return new ApplicationError(422, "invalid_ai_builder_proposal", "The proposed changes need review", "The model returned an invalid project proposal. Try a smaller change or another endpoint.");
}
