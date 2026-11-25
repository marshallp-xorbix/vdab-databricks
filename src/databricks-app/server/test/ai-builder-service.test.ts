import assert from "node:assert/strict";
import test from "node:test";
import { AiBuilderService } from "../src/ai-builder-service.ts";
import type { AiBuilderResourceContext, AiBuilderResourceContextService } from "../src/ai-builder-resource-context.ts";
import type { AiBuilderEvent, AiBuilderModelMessage } from "../src/ai-builder-contract.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import type { CallerIdentity, ProjectSummary, WorkspaceServingEndpointsPage } from "../src/contracts.ts";
import type { ProjectComponentsService } from "../src/db/project-components-service.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "../src/generation/custom-modules-template.ts";
import type { ProjectWorkflowService } from "../src/db/project-workflow-service.ts";
import type { ProjectCustomModulesService } from "../src/db/project-custom-modules-service.ts";
import type { ProjectService } from "../src/db/project-service.ts";
import type { WorkspaceResourcesService } from "../src/workspace-resources-service.ts";
import type { AiBuilderWorkspaceClient } from "../src/ai-builder-workspace-client.ts";

const CALLER: CallerIdentity = {
  userId: "ai-owner",
  preferredUsername: "ai-owner",
  email: "ai-owner@example.com",
  workspaceId: "workspace-1",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "viewer-token",
};

test("AiBuilderService_StreamsValidatedProposalFromTypedToolLoop", async () => {
  let invokeCount = 0;
  const workspaceClient = {
    invoke: async (_caller: CallerIdentity, endpointName: string, messages: AiBuilderModelMessage[]) => {
      invokeCount += 1;
      assert.equal(endpointName, "customer-model");
      if (invokeCount === 1) {
        assert.equal(messages.at(-1)?.role, "user");
        return createToolStreamResponse([
          {
            id: "label-1",
            name: "addLabel",
            arguments: {
              text: "Dashboard title",
              codeName: "titleLabel",
              fontSize: "medium",
              bold: false,
            },
          },
        ], "Adding a title");
      }
      assert.ok(messages.some((message) => message.role === "tool"));
      return createTextStreamResponse("Added a title.");
    },
  } as unknown as AiBuilderWorkspaceClient;
  const service = createService({ workspaceClient });
  const prepared = await service.prepare(CALLER, "request-1", "project-1", createRequest());
  const events: AiBuilderEvent[] = [];

  await prepared.execute(new AbortController().signal, async (event) => {
    events.push(event);
  });

  assert.equal(invokeCount, 2);
  const result = events.find((event) => event.event === "result");
  assert.ok(result?.event === "result");
  assert.equal(result.data.assistantMessage, "Added a title.");
  assert.equal(result.data.outcome, "completed");
  assert.equal(result.data.proposal?.components[0]?.codeName, "titleLabel");
  assert.equal(result.data.proposal?.components[0]?.properties.text, "Dashboard title");
});

test("AiBuilderService_RejectsViewersAndUnqueryableEndpointsBeforeModelCall", async () => {
  let invokeCount = 0;
  const workspaceClient = {
    invoke: async () => {
      invokeCount += 1;
      return createTextStreamResponse("should not run");
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

test("AiBuilderService_EmbeddingEndpoint_RejectsBeforeModelInvocation", async () => {
  const service = createService({ endpoint: { name: "customer-model", task: "llm/v1/embeddings", readiness: "ready", permissionLevel: "CAN_QUERY" } });
  await assert.rejects(service.prepare(CALLER, "request-1", "project-1", createRequest()), (error: unknown) => isApplicationError(error, 422));
});

test("AiBuilderService_RecoversFromToolErrorsThenCompletes", async () => {
  let invokeCount = 0;
  const workspaceClient = {
    invoke: async () => {
      invokeCount += 1;
      if (invokeCount === 1) {
        return createToolStreamResponse([
          {
            id: "bad-1",
            name: "addShowModalAction",
            arguments: {
              workflowCodeName: "missing",
              nodeId: "show1",
              modalCodeName: "workflowModal",
            },
          },
          {
            id: "label-1",
            name: "addLabel",
            arguments: { text: "Recovered", codeName: "recoveredLabel" },
          },
        ]);
      }
      return createTextStreamResponse("Recovered after a tool error.");
    },
  } as unknown as AiBuilderWorkspaceClient;
  const service = createService({ workspaceClient });
  const prepared = await service.prepare(CALLER, "request-1", "project-1", createRequest());
  const events: AiBuilderEvent[] = [];
  await prepared.execute(new AbortController().signal, async (event) => {
    events.push(event);
  });

  assert.equal(invokeCount, 2);
  const result = events.find((event) => event.event === "result");
  assert.ok(result?.event === "result");
  assert.equal(result.data.outcome, "completed");
  assert.equal(result.data.proposal?.components[0]?.codeName, "recoveredLabel");
});

test("AiBuilderService_StreamsNeedsClarificationWhenNoToolsAndNoChanges", async () => {
  const workspaceClient = {
    invoke: async () => createTextStreamResponse("NEEDS_CLARIFICATION: Which button should open the modal?"),
  } as unknown as AiBuilderWorkspaceClient;
  const service = createService({ workspaceClient });
  const prepared = await service.prepare(CALLER, "request-1", "project-1", createRequest());
  const events: AiBuilderEvent[] = [];
  await prepared.execute(new AbortController().signal, async (event) => {
    events.push(event);
  });

  const result = events.find((event) => event.event === "result");
  assert.ok(result?.event === "result");
  assert.equal(result.data.outcome, "needsClarification");
  assert.equal(result.data.proposal, null);
});

test("AiBuilderService_RepairsValidationFailureThenCompletes", async () => {
  let invokeCount = 0;
  const workspaceClient = {
    invoke: async (_caller: CallerIdentity, _endpoint: string, messages: AiBuilderModelMessage[]) => {
      invokeCount += 1;
      if (invokeCount === 1) {
        return createToolStreamResponse([
          {
            id: "button-1",
            name: "addButton",
            arguments: { codeName: "actionButton", label: "Run" },
          },
          {
            id: "workflow-1",
            name: "createWorkflow",
            arguments: {
              workflowCodeName: "badTrigger",
              triggerComponentCodeName: "actionButton",
              triggerEventKey: "onSubmit",
            },
          },
        ]);
      }
      if (invokeCount === 2) {
        return createTextStreamResponse("Perfect! I successfully created the workflow.");
      }
      if (invokeCount === 3) {
        assert.equal(messages.at(-1)?.role, "user");
        assert.match(String(messages.at(-1)?.content ?? ""), /VALIDATION_FAILED/);
        return createToolStreamResponse([
          {
            id: "delete-1",
            name: "deleteWorkflow",
            arguments: { workflowCodeName: "badTrigger" },
          },
          {
            id: "workflow-2",
            name: "createWorkflow",
            arguments: {
              workflowCodeName: "goodTrigger",
              triggerComponentCodeName: "actionButton",
              triggerEventKey: "onClick",
            },
          },
          {
            id: "toast-1",
            name: "addTriggerToastAction",
            arguments: {
              workflowCodeName: "goodTrigger",
              nodeId: "toast1",
              body: "Ready",
              toastDuration: "short",
            },
          },
        ]);
      }
      return createTextStreamResponse("Repaired the invalid workflow trigger.");
    },
  } as unknown as AiBuilderWorkspaceClient;
  const service = createService({ workspaceClient });
  const prepared = await service.prepare(CALLER, "request-1", "project-1", createRequest());
  const events: AiBuilderEvent[] = [];
  await prepared.execute(new AbortController().signal, async (event) => {
    events.push(event);
  });

  assert.equal(invokeCount, 4);
  assert.ok(events.some((event) =>
    event.event === "progress" &&
    event.data.message.includes("Repairing the proposal after validation")));
  const result = events.find((event) => event.event === "result");
  assert.ok(result?.event === "result");
  assert.equal(result.data.outcome, "completed");
  assert.equal(result.data.proposal?.workflow.workflows[0]?.codeName, "goodTrigger");
  assert.equal(result.data.assistantMessage, "Repaired the invalid workflow trigger.");
});

test("AiBuilderService_ExhaustedValidationRepairReturnsGroundedFailure", async () => {
  let invokeCount = 0;
  const workspaceClient = {
    invoke: async () => {
      invokeCount += 1;
      if (invokeCount === 1) {
        return createToolStreamResponse([
          {
            id: "button-1",
            name: "addButton",
            arguments: { codeName: "actionButton", label: "Run" },
          },
          {
            id: "workflow-1",
            name: "createWorkflow",
            arguments: {
              workflowCodeName: "badTrigger",
              triggerComponentCodeName: "actionButton",
              triggerEventKey: "onSubmit",
            },
          },
        ]);
      }
      return createTextStreamResponse("Perfect! I've successfully created a complete app.");
    },
  } as unknown as AiBuilderWorkspaceClient;
  const service = createService({ workspaceClient });
  const prepared = await service.prepare(CALLER, "request-1", "project-1", createRequest());
  const events: AiBuilderEvent[] = [];
  await prepared.execute(new AbortController().signal, async (event) => {
    events.push(event);
  });

  // tools + failed finalize + 2 repair attempts that still fail finalize
  assert.equal(invokeCount, 4);
  const result = events.find((event) => event.event === "result");
  assert.ok(result?.event === "result");
  assert.equal(result.data.outcome, "unableToComplete");
  assert.equal(result.data.proposal, null);
  assert.match(result.data.assistantMessage, /^I could not apply a valid set of project changes/);
  assert.match(result.data.assistantMessage, /Validation:/);
  assert.doesNotMatch(result.data.assistantMessage, /Perfect! I've successfully created/);
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
  volumes: { status: "available", items: ["main.default.uploads"] },
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
    invoke: async () => createTextStreamResponse("ok"),
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

function createToolStreamResponse(
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
  content?: string,
): Response {
  const frames = [
    ...(content
      ? [`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`]
      : []),
    `data: ${JSON.stringify({
      choices: [{ delta: { tool_calls: toolCalls.map((toolCall, index) => ({
        index,
        id: toolCall.id,
        function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) },
      })) } }],
    })}\n\n`,
    "data: [DONE]\n\n",
  ];
  return createStream(frames);
}

function createTextStreamResponse(content: string): Response {
  return createStream([
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
    "data: [DONE]\n\n",
  ]);
}

function createStream(frames: string[]): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(new TextEncoder().encode(frame));
      }
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
}

function isApplicationError(value: unknown, expectedStatus: number): boolean {
  return value instanceof Error && "status" in value && value.status === expectedStatus;
}
