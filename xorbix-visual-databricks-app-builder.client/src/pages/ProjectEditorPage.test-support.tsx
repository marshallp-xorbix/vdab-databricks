import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string | undefined) => void;
    options: { ariaLabel?: string };
  }) => (
    <textarea
      aria-label={options.ariaLabel ?? "Editor content"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock("../components/AppBuilderComponents/AppCanvas/MainFlowView", () => ({
  default: ({
    onNodeClick,
    onSelectComponent,
    formComponents,
  }: {
    onNodeClick: (nodeId: string, nodeType: "page" | "modal") => void;
    onSelectComponent?: (id: string | null) => void;
    formComponents: Array<{
      id: string;
      type: string;
      codeName: string;
      props: Record<string, unknown>;
    }>;
  }) => (
    <div>
      <button
        type="button"
        onDoubleClick={() => onNodeClick("main-page", "page")}
      >
        Main Page graph node
      </button>
      <button
        type="button"
        onDoubleClick={() => onNodeClick("review-modal", "modal")}
      >
        Review modal graph node
      </button>
      {formComponents.filter((component) => component.type === "Modal").map((component, index) => {
        const title = typeof component.props.title === "string"
          ? component.props.title
          : component.codeName;
        const label = `${index + 1}. Modal: ${title}`;
        return (
          <button
            key={component.id}
            type="button"
            onClick={() => onSelectComponent?.(component.id)}
            onDoubleClick={() => onNodeClick(component.id, "modal")}
          >
            {label}
          </button>
        );
      })}
    </div>
  ),
}));
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { IProject } from "../models/Project";
import type { IProjectWorkflowDocument } from "../models/ProjectWorkflow";
import type { IProjectCustomModulesDocument } from "../models/ProjectCustomModules";
import { componentRegistryFixture } from "../test/componentRegistryFixture";
import { ThemeProvider } from "../context/ThemeContext";
import { SettingsProvider } from "../context/SettingsContext";
import StandaloneAppLayout from "../layouts/StandaloneAppLayout";
import { getProject, updateProject } from "../api/projectsApi";
import { listProjectCollaborators } from "../api/projectCollaboratorsApi";
import { getProjectWorkflow, replaceProjectWorkflow } from "../api/projectWorkflowApi";
import { getProjectCustomModules, replaceProjectCustomModules } from "../api/projectCustomModulesApi";
import { getComponentRegistry } from "../api/componentRegistryApi";
import { canvasApi } from "../providers/CanvasApi";
import { toLegacyComponentRegistry } from "../utils/projectComponentRegistryAdapter";
import { listWorkspaceServingEndpoints } from "../api/workspaceResourcesApi";
import type { IWorkspaceServingEndpointsPage } from "../models/WorkspaceServingEndpoint";
import {
  generateProjectPreview,
  getProjectComponents,
  replaceProjectComponents,
} from "../api/projectComponentsApi";
import ProjectEditorPage from "./ProjectEditorPage";

vi.mock("../layouts/StandaloneMobileNavigation", () => ({
  default: () => null,
}));

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
export const componentRegistry = componentRegistryFixture;


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
  vi.spyOn(canvasApi, "getRegistry").mockResolvedValue(
    toLegacyComponentRegistry(componentRegistry),
  );
  listWorkspaceServingEndpointsMock.mockResolvedValue({
    items: [],
    authenticationMode: "local-test",
  } satisfies IWorkspaceServingEndpointsPage);
  listProjectCollaboratorsMock.mockResolvedValue([]);
  vi.stubGlobal("fetch", createEditorFetch());
}

export async function renderProjectEditorPage(
  options: { openMainPage?: boolean } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/apps",
        element: <StandaloneAppLayout />,
        children: [
          { path: ":appId", element: <ProjectEditorPage /> },
          { index: true, element: <h1>Project list route</h1> },
        ],
      },
    ],
    { initialEntries: ["/apps/project-1"] },
  );

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <RouterProvider router={router} />
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );

  if (options.openMainPage !== false) {
    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "Main Page graph node" }),
    );
  }

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

    if (requestPath.endsWith("/api/v1/component-definitions")) {
      return jsonResponse(componentRegistryFixture);
    }
    if (requestPath.endsWith("/api/v1/session")) {
      return jsonResponse({
        userId: "test-user",
        preferredUsername: "VDAB test user",
        email: "vdab-test@example.invalid",
        workspace: { id: "test-workspace", host: "https://workspace.example.invalid" },
        authenticationMode: "databricks",
        installationAdmin: true,
      });
    }
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
