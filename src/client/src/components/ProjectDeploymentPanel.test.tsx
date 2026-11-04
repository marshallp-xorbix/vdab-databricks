import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDeploymentPanel from "./ProjectDeploymentPanel";
import { useProjectDeploymentReadiness } from "../hooks/useProjectDeploymentReadiness";
import { useProjectDeployments } from "../hooks/useProjectDeployments";
import { useStartProjectDeployment } from "../hooks/useStartProjectDeployment";
import { useWorkspaceAppDeploymentTarget } from "../hooks/useWorkspaceAppDeploymentTarget";
import { useWorkspaceApps } from "../hooks/useWorkspaceApps";

vi.mock("../hooks/useProjectDeploymentReadiness", () => ({
  useProjectDeploymentReadiness: vi.fn(),
}));
vi.mock("../hooks/useProjectDeployments", () => ({
  useProjectDeployments: vi.fn(),
}));
vi.mock("../hooks/useRetryProjectDeployment", () => ({
  useRetryProjectDeployment: vi.fn(),
}));
vi.mock("../hooks/useRollbackProjectDeployment", () => ({
  useRollbackProjectDeployment: vi.fn(),
}));
vi.mock("../hooks/useStartProjectDeployment", () => ({
  useStartProjectDeployment: vi.fn(),
}));
vi.mock("../hooks/useUpdateProjectResourceGrants", () => ({
  useUpdateProjectResourceGrants: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
}));
vi.mock("../hooks/useWorkspaceAppDeploymentTarget", () => ({
  useWorkspaceAppDeploymentTarget: vi.fn(),
}));
vi.mock("../hooks/useWorkspaceApps", () => ({ useWorkspaceApps: vi.fn() }));
vi.mock("../hooks/useWorkspaceSqlWarehouses", () => ({
  useWorkspaceSqlWarehouses: () => ({ data: { items: [] }, isPending: false, isError: false }),
}));

const useReadinessMock = vi.mocked(useProjectDeploymentReadiness);
const useHistoryMock = vi.mocked(useProjectDeployments);
const useStartMock = vi.mocked(useStartProjectDeployment);
const useTargetMock = vi.mocked(useWorkspaceAppDeploymentTarget);
const useAppsMock = vi.mocked(useWorkspaceApps);
const mutateAsync = vi.fn();
const readinessRefetch = vi.fn();

describe("ProjectDeploymentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReadinessMock.mockReturnValue({
      data: { userApiScopes: ["sql"], blockers: [] },
      isPending: false,
      isError: false,
      refetch: readinessRefetch,
    } as never);
    useHistoryMock.mockReturnValue({
      data: { childApp: null, items: [] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    useStartMock.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    useTargetMock.mockImplementation(
      (appName) =>
        ({
          data: appName === "existing-child" ? makeTarget(appName) : null,
          isPending: false,
          isError: false,
        }) as never,
    );
    useAppsMock.mockReturnValue({
      data: {
        pages: [{ items: [{ name: "existing-child", appState: "STOPPED" }] }],
      },
      isPending: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    } as never);
  });

  it("requires a valid name and deploys a new app without replacement confirmation", async () => {
    render(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit
        hasUnsavedChanges={false}
      />,
    );
    const deployButton = screen.getByRole("button", {
      name: "Create and deploy App",
    });
    expect(deployButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("New App name"), {
      target: { value: "new-child" },
    });
    await waitFor(() => expect(deployButton).toBeEnabled());
    fireEvent.click(deployButton);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        projectId: "project-id",
        mode: "createNew",
        appName: "new-child",
        confirmOverwrite: false,
        secretResources: [],
      }),
    );
  });

  it("adds secret identifiers to a new App deployment without collecting values", async () => {
    render(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit
        hasUnsavedChanges={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("New App name"), {
      target: { value: "new-child" },
    });
    fireEvent.change(screen.getByLabelText("Secret scope"), {
      target: { value: "service-scope" },
    });
    fireEvent.change(screen.getByLabelText("App resource key"), {
      target: { value: "service-api" },
    });
    fireEvent.change(screen.getByLabelText("Secret key"), {
      target: { value: "api-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add secret" }));
    expect(screen.getByText("service-scope / api-key")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create and deploy App" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        projectId: "project-id",
        mode: "createNew",
        appName: "new-child",
        confirmOverwrite: false,
        secretResources: [{ name: "service-api", scope: "service-scope", key: "api-key" }],
      }),
    );
  });

  it("shows the existing target and requires replacement confirmation before linking", async () => {
    render(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit
        hasUnsavedChanges={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("radio", { name: "Link an existing App" }),
    );
    fireEvent.change(screen.getByLabelText("Existing workspace App"), {
      target: { value: "existing-child" },
    });

    expect(
      await screen.findByText("Current target: existing-child"),
    ).toBeInTheDocument();
    const deployButton = screen.getByRole("button", {
      name: "Link and deploy App",
    });
    expect(deployButton).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /confirm that deploying will replace/i,
      }),
    );
    await waitFor(() => expect(deployButton).toBeEnabled());
    fireEvent.click(deployButton);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        projectId: "project-id",
        mode: "linkExisting",
        appName: "existing-child",
        confirmOverwrite: true,
        secretResources: [],
      }),
    );
  });

  it("requires every existing read-only secret resource to be selected", async () => {
    const secret = {
      name: "api-key",
      description: "API key",
      secret: { scope: "service-scope", key: "api-key", permission: "READ" as const },
    };
    useTargetMock.mockImplementation(
      (appName) =>
        ({
          data: appName === "existing-child"
            ? { ...makeTarget(appName), secretResources: [secret] }
            : null,
          isPending: false,
          isError: false,
        }) as never,
    );
    render(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit
        hasUnsavedChanges={false}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Link an existing App" }));
    fireEvent.change(screen.getByLabelText("Existing workspace App"), {
      target: { value: "existing-child" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /confirm that deploying will replace/i }),
    );
    const deployButton = screen.getByRole("button", { name: "Link and deploy App" });
    expect(deployButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /api-key/ }));
    await waitFor(() => expect(deployButton).toBeEnabled());
    fireEvent.click(deployButton);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        projectId: "project-id",
        mode: "linkExisting",
        appName: "existing-child",
        confirmOverwrite: true,
        secretResources: [
          { name: "api-key", scope: "service-scope", key: "api-key" },
        ],
      }),
    );
  });

  it("blocks deployment when project edits are unsaved or required scopes are absent", () => {
    useReadinessMock.mockReturnValue({
      data: {
        userApiScopes: [],
        blockers: [
          {
            code: "jobs",
            detail: "The Jobs workflow needs a supported permission.",
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    render(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit
        hasUnsavedChanges
      />,
    );

    expect(
      screen.getByText(
        "Save all project edits before deploying. Deployments always use the saved version.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The Jobs workflow needs a supported permission."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create and deploy App" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a viewer in the read-only history state", () => {
    render(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit={false}
        hasUnsavedChanges={false}
      />,
    );

    expect(
      screen.getByText(
        "You have read-only access and cannot deploy this project's child App.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /deploy app/i }),
    ).not.toBeInTheDocument();
  });

  it("refreshes deployment readiness after saved edits become current", () => {
    const { rerender } = render(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit
        hasUnsavedChanges
      />,
    );

    rerender(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit
        hasUnsavedChanges={false}
      />,
    );

    expect(readinessRefetch).toHaveBeenCalledOnce();
  });

  it("links a linked child App and its Databricks runtime logs", () => {
    useHistoryMock.mockReturnValue({
      data: {
        childApp: {
          appId: "app-id",
          appName: "existing-child",
          mode: "linkExisting",
          sourceCodePath: "/Workspace/Users/user@example.test/source",
        },
        items: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    useTargetMock.mockReturnValue({
      data: {
        ...makeTarget("existing-child", "team-apps", ["sql:restricted-query"]),
        appUrl: "https://child-app.example.databricksapps.com/",
      },
      isPending: false,
      isError: false,
    } as never);

    render(
      <ProjectDeploymentPanel
        projectId="project-id"
        canEdit
        hasUnsavedChanges={false}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Open child App" }),
    ).toHaveAttribute("href", "https://child-app.example.databricksapps.com/");
    expect(
      screen.getByRole("link", { name: "View runtime logs" }),
    ).toHaveAttribute(
      "href",
      "https://child-app.example.databricksapps.com/logz",
    );
    expect(screen.getByText("App Space: team-apps")).toBeInTheDocument();
    expect(
      screen.getByText("Effective authorization scopes: sql:restricted-query"),
    ).toBeInTheDocument();
  });
});

function makeTarget(
  name: string,
  spaceName: string | null = null,
  effectiveUserApiScopes: string[] | null = null,
) {
  return {
    appId: "app-id",
    name,
    description: null,
    spaceName,
    effectiveUserApiScopes,
    appState: "STOPPED",
    computeState: "STOPPED",
    appUrl: null,
    activeDeploymentId: "current-deployment",
    sourceCodePath: "/Workspace/Users/user@example.test/source",
    usesGitSource: false,
    userApiScopes: ["sql"],
    secretResources: [],
  };
}
