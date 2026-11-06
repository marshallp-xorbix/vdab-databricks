import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProjectAppResourceGrantsEditor from "./ProjectAppResourceGrantsEditor";
import type { IWorkspaceAppDeploymentTarget } from "../models/ProjectDeployments";

const mutateAsync = vi.fn().mockResolvedValue(undefined);
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
  useWorkspaceSqlWarehouses: () => ({ data: { items: [] }, isPending: false, isError: false }),
}));
vi.mock("./ProjectAdditionalResourceGrantForm", () => ({
  default: () => null,
}));

const target = {
  appResources: [{
    name: "test-secret",
    description: "Test grant",
    secret: { scope: "test", key: "example", permission: "READ" },
  }],
  unsupportedResourceCount: 0,
} as IWorkspaceAppDeploymentTarget;

describe("ProjectAppResourceGrantsEditor", () => {
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

    expect(screen.getByRole("combobox", { name: "Permission for test-secret" })).toBeDisabled();
    expect(screen.queryByRole("group", { name: "Add secret grant" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const permission = screen.getByRole("combobox", { name: "Permission for test-secret" });
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
      resources: [{
        name: "test-secret",
        description: "Test grant",
        secret: { scope: "test", key: "example", permission: "WRITE" },
      }],
    });
  });
});
