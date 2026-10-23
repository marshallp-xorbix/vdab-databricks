import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { IProject } from "../models/Project";
import type { IProjectWorkflowDocument } from "../models/ProjectWorkflow";
import type { IProjectCustomModulesDocument } from "../models/ProjectCustomModules";
import type { IComponentRegistry } from "../models/ComponentRegistry";
import { ThemeProvider } from "../context/ThemeContext";
import { getProject, updateProject } from "../api/projectsApi";
import { listProjectCollaborators } from "../api/projectCollaboratorsApi";
import { getProjectWorkflow, replaceProjectWorkflow } from "../api/projectWorkflowApi";
import { getProjectCustomModules, replaceProjectCustomModules } from "../api/projectCustomModulesApi";
import { getComponentRegistry } from "../api/componentRegistryApi";
import { listWorkspaceServingEndpoints } from "../api/workspaceResourcesApi";
import type { IWorkspaceServingEndpointsPage } from "../models/WorkspaceServingEndpoint";
import {
  generateProjectPreview,
  getProjectComponents,
  replaceProjectComponents,
} from "../api/projectComponentsApi";
import ProjectEditorPage from "./ProjectEditorPage";

vi.mock("../api/projectsApi", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock("../api/projectCollaboratorsApi", () => ({
  listProjectCollaborators: vi.fn(),
  revokeProjectCollaborator: vi.fn(),
}));
vi.mock("../api/projectComponentsApi", () => ({
  generateProjectPreview: vi.fn(),
  getProjectComponents: vi.fn(),
  replaceProjectComponents: vi.fn(),
}));
vi.mock("../api/projectWorkflowApi", () => ({
  getProjectWorkflow: vi.fn(),
  replaceProjectWorkflow: vi.fn(),
}));
vi.mock("../api/projectCustomModulesApi", () => ({
  getProjectCustomModules: vi.fn(),
  replaceProjectCustomModules: vi.fn(),
}));
vi.mock("../api/componentRegistryApi", () => ({
  getComponentRegistry: vi.fn(),
}));
vi.mock("../api/workspaceResourcesApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/workspaceResourcesApi")>(),
  listWorkspaceServingEndpoints: vi.fn(),
}));

export const getProjectMock = vi.mocked(getProject);
export const updateProjectMock = vi.mocked(updateProject);
export const listProjectCollaboratorsMock = vi.mocked(listProjectCollaborators);
export const getProjectComponentsMock = vi.mocked(getProjectComponents);
export const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
export const generateProjectPreviewMock = vi.mocked(generateProjectPreview);
export const getProjectWorkflowMock = vi.mocked(getProjectWorkflow);
export const replaceProjectWorkflowMock = vi.mocked(replaceProjectWorkflow);
export const getProjectCustomModulesMock = vi.mocked(getProjectCustomModules);
export const replaceProjectCustomModulesMock = vi.mocked(replaceProjectCustomModules);
export const getComponentRegistryMock = vi.mocked(getComponentRegistry);
export const listWorkspaceServingEndpointsMock = vi.mocked(listWorkspaceServingEndpoints);

export const project: IProject = {
  id: "project-1",
  name: "Revenue dashboard",
  description: "Finance team",
  version: 1,
  createdBy: "user-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};
export const workflowDocument: IProjectWorkflowDocument = {
  projectId: "project-1",
  version: 1,
  workflow: { version: 1, workflows: [] },
};
export const customModulesDocument: IProjectCustomModulesDocument = {
  projectId: "project-1",
  version: 1,
  source: "# custom modules\n",
};
export const componentRegistry: IComponentRegistry = {
  version: 1,
  components: [{
    id: "template-button",
    codeName: "templateButton",
    type: "Button",
    category: "Controls",
    icon: "MousePointerClick",
    layout: null,
    schemaVersion: 1,
    bindings: null,
    supportedBindings: null,
    supportedEvents: ["onClick"],
    children: null,
    props: {},
  }],
};


export function resetProjectEditorTestState(): void {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
}

export function initializeProjectEditorTestState(): void {
  getProjectMock.mockResolvedValue(project);
  getProjectComponentsMock.mockResolvedValue({ projectId: "project-1", version: 1, components: [] });
  getProjectWorkflowMock.mockResolvedValue(workflowDocument);
  getProjectCustomModulesMock.mockResolvedValue(customModulesDocument);
  getComponentRegistryMock.mockResolvedValue(componentRegistry);
  listWorkspaceServingEndpointsMock.mockResolvedValue({
    items: [],
    authenticationMode: "local-test",
  } satisfies IWorkspaceServingEndpointsPage);
  listProjectCollaboratorsMock.mockResolvedValue([]);
  vi.stubGlobal("fetch", createEditorFetch());
}

export function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/apps/:appId", element: <ProjectEditorPage /> },
      { path: "/apps", element: <h1>Project list route</h1> },
    ],
    { initialEntries: ["/apps/project-1"] },
  );

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );

  return { router, unmount: rendered.unmount };
}

export function createEditorFetch(aiBuilderStream?: string): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    const requestPath = new URL(requestUrl, "http://localhost").pathname;

    if (requestPath.endsWith("/ai-builder")) {
      if (aiBuilderStream === undefined) return jsonResponse({ detail: "Unexpected AI Builder request." }, 500);
      return new Response(aiBuilderStream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
    if (requestPath.endsWith("/deployments/readiness")) {
      return jsonResponse({ userApiScopes: ["sql"], appResources: [], blockers: [] });
    }
    if (requestPath.endsWith("/deployments")) {
      return jsonResponse({ childApp: null, items: [] });
    }
    return jsonResponse({ detail: "The editor test did not configure this request." }, 404);
  }) as typeof fetch;
}

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
