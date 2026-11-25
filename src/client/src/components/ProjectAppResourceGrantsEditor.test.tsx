import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProjectAppResourceGrantsEditor from "./ProjectAppResourceGrantsEditor";
import type { IWorkspaceAppDeploymentTarget } from "../models/ProjectDeployments";

const mutateAsync = vi.fn().mockResolvedValue({
  appName: "child-app",
  resourceCount: 1,
  appResources: [],
  appUpdateTime: null,
  unsupportedResourceCount: 0,
});
const reset = vi.fn();

vi.mock("../hooks/useUpdateProjectResourceGrants", () => ({
  useUpdateProjectResourceGrants: () => ({
    mutateAsync,
    reset,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));
vi.mock("../hooks/useWorkspaceSqlWarehouses", () => ({
  useWorkspaceSqlWarehouses: () => ({
    data: { items: [] },
    isPending: false,
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../hooks/useWorkspaceJobs", () => ({
  useWorkspaceJobs: () => ({
    data: { items: [] },
    isPending: false,
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../hooks/useWorkspaceGenieSpaces", () => ({
  useWorkspaceGenieSpaces: () => ({
    data: { items: [] },
    isPending: false,
    error: null,
  }),
}));
vi.mock("../hooks/useWorkspaceServingEndpoints", () => ({
  useWorkspaceServingEndpoints: () => ({
    data: { items: [] },
    isPending: false,
    error: null,
  }),
}));
vi.mock("../hooks/useWorkspaceSecretScopes", () => ({
  useWorkspaceSecretScopes: () => ({
    data: {
      items: [{ name: "test" }, { name: "other-scope" }],
    },
    isPending: false,
    error: null,
  }),
}));
vi.mock("../hooks/useWorkspaceSecretKeys", () => ({
  useWorkspaceSecretKeys: (scope: string | null) => ({
    data: {
      items:
        scope === "test"
          ? [{ name: "example" }, { name: "other-key" }]
          : [],
    },
    isPending: false,
    error: null,
  }),
}));
vi.mock("../hooks/useWorkspaceExperiments", () => ({
  useWorkspaceExperiments: () => ({
    data: { items: [{ experimentId: "exp-1", name: "/Users/demo" }] },
    isPending: false,
    error: null,
  }),
}));

const target = {
  name: "child-app",
  appResources: [
    {
      name: "test-secret",
      description: "Test grant",
      secret: { scope: "test", key: "example", permission: "READ" },
    },
  ],
  unsupportedResourceCount: 0,
} as IWorkspaceAppDeploymentTarget;

describe("ProjectAppResourceGrantsEditor", () => {
  it("shows missing required resources with restore action", async () => {
    const user = userEvent.setup();
    const requiredWarehouse = {
      name: "sql-warehouse",
      description: "Required SQL warehouse",
      sql_warehouse: {
        id: "warehouse-123",
        permission: "CAN_USE" as const,
      },
    };
    render(
      <ProjectAppResourceGrantsEditor
        projectId="project-one"
        target={target}
        requiredResources={[requiredWarehouse]}
        canEdit
        isLinked
      />,
    );

    expect(
      screen.getByText(/1 required project resource is missing/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add required" }));
    expect(screen.getByText("sql-warehouse")).toBeInTheDocument();
    expect(
      screen.queryByText(/required project resource is missing/i),
    ).not.toBeInTheDocument();
  });

  it("keeps Edit available when unsupported resources are present", () => {
    render(
      <ProjectAppResourceGrantsEditor
        projectId="project-one"
        target={{ ...target, unsupportedResourceCount: 1 }}
        requiredResources={[]}
        canEdit
        isLinked
      />,
    );

    expect(
      screen.getByText(/resource type\(s\) this editor cannot safely preserve/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled();
  });

  it("starts read only, cancels draft changes, and saves from edit mode", async () => {
    const user = userEvent.setup();
    render(
      <ProjectAppResourceGrantsEditor
        projectId="project-one"
        target={target}
        requiredResources={[]}
        canEdit
        isLinked
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "Permission for test-secret" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const permission = screen.getByRole("combobox", {
      name: "Permission for test-secret",
    });
    await user.selectOptions(permission, "WRITE");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(permission).toHaveValue("READ");
    expect(permission).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(permission, "WRITE");
    await user.click(screen.getByRole("button", { name: "Save resources" }));
    expect(mutateAsync).toHaveBeenCalledWith({
      projectId: "project-one",
      resources: [
        {
          name: "test-secret",
          description: "Test grant",
          secret: { scope: "test", key: "example", permission: "WRITE" },
        },
      ],
    });
  });

  it("blocks Save until a newly added resource target is complete", async () => {
    const user = userEvent.setup();
    render(
      <ProjectAppResourceGrantsEditor
        projectId="project-one"
        target={{ ...target, appResources: [] }}
        requiredResources={[]}
        canEdit
        isLinked
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Resource type" }),
      "secret",
    );
    await user.click(screen.getByRole("button", { name: "Add resource" }));
    expect(
      screen.getByRole("button", { name: "Save resources" }),
    ).toBeDisabled();
    expect(screen.getByText(/Select a secret scope and key/i)).toBeInTheDocument();
  });
});
