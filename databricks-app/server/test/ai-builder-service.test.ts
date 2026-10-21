import assert from "node:assert/strict";
import test from "node:test";
import { AiBuilderService } from "../src/ai-builder-service.ts";
import type { AiBuilderResourceContext, AiBuilderResourceContextService } from "../src/ai-builder-resource-context.ts";
import type { AiBuilderEvent } from "../src/ai-builder-contract.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import type { CallerIdentity, ProjectSummary, WorkspaceServingEndpointsPage } from "../src/contracts.ts";
import type { ProjectComponentsService } from "../src/db/project-components-service.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "../src/generation/custom-modules-template.ts";
import type { ProjectWorkflowService } from "../src/db/project-workflow-service.ts";
import type { ProjectCustomModulesService } from "../src/db/project-custom-modules-service.ts";
import type { ProjectService } from "../src/db/project-service.ts";
import type { WorkspaceResourcesService } from "../src/workspace-resources-service.ts";
import { AiBuilderWorkspaceClient } from "../src/ai-builder-workspace-client.ts";

const CALLER: CallerIdentity = {
  userId: "ai-owner",
  preferredUsername: "ai-owner",
  email: "ai-owner@example.com",
  workspaceId: "workspace-1",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "viewer-token",
};

test("AiBuilderService_StreamsValidatedProposalWithoutPersistingIt", async () => {
  let invokeCount = 0;
  let requestMessages: Array<{ role: string; content: string }> = [];
  const workspaceClient = {
    invoke: async (_caller: CallerIdentity, endpointName: string, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) => {
      invokeCount += 1;
      assert.equal(endpointName, "customer-model");
      requestMessages = messages;
      return createProposalStreamResponse();
    },
  } as unknown as AiBuilderWorkspaceClient;
  const service = createService({ workspaceClient });
  const prepared = await service.prepare(CALLER, "request-1", "project-1", createRequest());
  const events: AiBuilderEvent[] = [];

  await prepared.execute(new AbortController().signal, async (event) => {
    events.push(event);
  });

  assert.equal(invokeCount, 1);
  assert.equal(requestMessages.at(-1)?.content, "Add a title");
  assert.match(requestMessages[0]?.content ?? "", /main\.default\.customers/);
  assert.equal(events[0]?.event, "progress");
  const result = events.find((event) => event.event === "result");
  assert.ok(result?.event === "result");
  assert.equal(result.data.assistantMessage, "Added a title.");
  assert.deepEqual(result.data.proposal, {
    components: [{
      key: "title-label",
      type: "Label",
      schemaVersion: 1,
      componentVersion: 1,
      codeName: null,
      description: null,
      properties: { text: "Dashboard title", fontSize: "medium", bold: false },
      bindings: null,
      children: [],
      layout: null,
    }],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  });
  assert.equal(result.data.version, 1);
});

test("AiBuilderService_RejectsViewersAndUnqueryableEndpointsBeforeModelCall", async () => {
  let invokeCount = 0;
  const workspaceClient = {
    invoke: async () => {
      invokeCount += 1;
      return createProposalStreamResponse();
    },
  } as unknown as AiBuilderWorkspaceClient;
  const viewerService = createService({ workspaceClient, callerRole: "viewer" });
  await assert.rejects(
    viewerService.prepare(CALLER, "request-1", "project-1", createRequest()),
    (error: unknown) => isApplicationError(error, 403),
  );

  const endpointService = createService({
    workspaceClient,
    endpoint: { name: "customer-model", readiness: "ready", permissionLevel: "CAN_VIEW" },
  });
  await assert.rejects(
    endpointService.prepare(CALLER, "request-1", "project-1", createRequest()),
    (error: unknown) => isApplicationError(error, 403),
  );
  assert.equal(invokeCount, 0);
});

test("AiBuilderService_RejectsStaleProjectBeforeContactingEndpoint", async () => {
  let endpointListCount = 0;
  const workspaceResources = {
    listServingEndpoints: async (): Promise<WorkspaceServingEndpointsPage> => {
      endpointListCount += 1;
      return { items: [{ name: "customer-model", readiness: "ready", permissionLevel: "CAN_QUERY" }], authenticationMode: "databricks" };
    },
  } as unknown as WorkspaceResourcesService;
  const service = createService({ workspaceResources, projectVersion: 2 });

  await assert.rejects(
    service.prepare(CALLER, "request-1", "project-1", createRequest()),
    (error: unknown) => isApplicationError(error, 409),
  );
  assert.equal(endpointListCount, 0);
});

interface ServiceOverrides {
  workspaceClient?: AiBuilderWorkspaceClient;
  workspaceResources?: WorkspaceResourcesService;
  callerRole?: ProjectSummary["callerRole"];
  projectVersion?: number;
  endpoint?: WorkspaceServingEndpointsPage["items"][number];
}

const TEST_RESOURCE_CONTEXT: AiBuilderResourceContext = {
  unityCatalogTables: { status: "available", items: ["main.default.customers"] },
  jobs: { status: "empty", items: [] },
  sqlWarehouses: { status: "empty", items: [] },
  lakebaseAutoscaling: { status: "unavailable", items: [], reason: "permission_required" },
};

function createService(overrides: ServiceOverrides = {}): AiBuilderService {
  const version = overrides.projectVersion ?? 1;
  const project: ProjectSummary = {
    id: "project-1",
    name: "Standalone project",
    description: null,
    version,
    createdBy: CALLER.userId,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    callerRole: overrides.callerRole ?? "owner",
  };
  const projectService = {
    getProject: async () => project,
  } as unknown as ProjectService;
  const projectComponentsService = {
    getComponents: async () => ({ projectId: "project-1", version, components: [] }),
  } as unknown as ProjectComponentsService;
  const projectWorkflowService = {
    getWorkflow: async () => ({ projectId: "project-1", version, workflow: { version: 1, workflows: [] } }),
  } as unknown as ProjectWorkflowService;
  const projectCustomModulesService = {
    getCustomModules: async () => ({ projectId: "project-1", version, source: DEFAULT_CUSTOM_MODULES_SOURCE }),
  } as unknown as ProjectCustomModulesService;
  const workspaceResources = overrides.workspaceResources ?? {
    listServingEndpoints: async (): Promise<WorkspaceServingEndpointsPage> => ({
      items: [overrides.endpoint ?? { name: "customer-model", readiness: "ready", permissionLevel: "CAN_QUERY" }],
      authenticationMode: "databricks",
    }),
  } as unknown as WorkspaceResourcesService;
  const workspaceClient = overrides.workspaceClient ?? {
    invoke: async () => createProposalStreamResponse(),
  } as unknown as AiBuilderWorkspaceClient;
  const resourceContext = {
    getContext: async () => TEST_RESOURCE_CONTEXT,
  } as unknown as AiBuilderResourceContextService;

  return new AiBuilderService(
    projectService,
    projectComponentsService,
    projectWorkflowService,
    projectCustomModulesService,
    workspaceResources,
    new ComponentRegistryService(),
    workspaceClient,
    resourceContext,
  );
}

function createRequest(): Record<string, unknown> {
  return {
    version: 1,
    endpointName: "customer-model",
    prompt: "Add a title",
    history: [],
    components: [],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  };
}

function createProposalStreamResponse(): Response {
  const argumentsValue = JSON.stringify({
    assistantMessage: "Added a title.",
    operationsJson: JSON.stringify([{
      type: "addComponent",
      component: {
        key: "title-label",
        type: "Label",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: null,
        description: null,
        properties: { text: "Dashboard title", fontSize: "medium", bold: false },
        bindings: null,
        children: [],
        layout: null,
      },
    }]),
  });
  const chunk = JSON.stringify({
    choices: [{ delta: { tool_calls: [{
      index: 0,
      function: { name: "apply_project_operations", arguments: argumentsValue },
    }] } }],
  });
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
}

function isApplicationError(value: unknown, expectedStatus: number): boolean {
  return value instanceof Error && "status" in value && value.status === expectedStatus;
}
