import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AutoscalingPostgresTargetFields } from "./ProjectAppResourceLakebaseTargetFields";
import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { buildAutoscalingPostgresDatabasePath } from "../utils/appResourcePostgresPath";

vi.mock("../hooks/useWorkspaceLakebaseProjects", () => ({
  useWorkspaceLakebaseProjects: () => ({
    data: {
      items: [
        { projectId: "project-one", displayName: "Project One" },
        { projectId: "project-two", displayName: "Project Two" },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../hooks/useWorkspaceLakebaseBranches", () => ({
  useWorkspaceLakebaseBranches: (projectId: string | null) => ({
    data: {
      items:
        projectId === "project-one"
          ? [
              {
                branchId: "branch-main",
                isDefault: true,
                state: "READY",
              },
            ]
          : [],
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../hooks/useWorkspaceLakebaseDatabases", () => ({
  useWorkspaceLakebaseDatabases: (
    projectId: string | null,
    branchId: string | null,
  ) => ({
    data: {
      items:
        projectId === "project-one" && branchId === "branch-main"
          ? [
              {
                databaseId: "db-one",
                databaseName: "databricks_postgres",
              },
            ]
          : [],
    },
    isLoading: false,
    error: null,
  }),
}));

function emptyPostgresResource(): Extract<
  IWorkspaceAppResource,
  { postgres: unknown }
> {
  return {
    name: "autoscaling-lakebase",
    description: "",
    postgres: { database: "", permission: "CAN_CONNECT_AND_CREATE" },
  };
}

describe("AutoscalingPostgresTargetFields", () => {
  it("keeps the selected project and enables the branch picker", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let resource = emptyPostgresResource();

    function handleChange(next: IWorkspaceAppResource) {
      resource = next as typeof resource;
      onChange(next);
      view.rerender(
        <AutoscalingPostgresTargetFields
          resource={resource}
          onChange={handleChange}
        />,
      );
    }

    const view = render(
      <AutoscalingPostgresTargetFields
        resource={resource}
        onChange={handleChange}
      />,
    );

    const project = screen.getByRole("combobox", {
      name: "Lakebase project for autoscaling-lakebase",
    });
    expect(
      screen.getByRole("combobox", {
        name: "Branch for autoscaling-lakebase",
      }),
    ).toBeDisabled();

    await user.click(project);
    await user.click(await screen.findByRole("option", { name: "Project One" }));

    expect(
      screen.getByRole("combobox", {
        name: "Lakebase project for autoscaling-lakebase",
      }),
    ).toHaveTextContent("Project One");
    expect(
      screen.getByRole("combobox", {
        name: "Branch for autoscaling-lakebase",
      }),
    ).toBeEnabled();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        postgres: expect.objectContaining({
          database: "",
          branch: undefined,
        }),
      }),
    );
  });

  it("writes the full wire path once project, branch, and database are selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let resource = emptyPostgresResource();

    function handleChange(next: IWorkspaceAppResource) {
      resource = next as typeof resource;
      onChange(next);
      view.rerender(
        <AutoscalingPostgresTargetFields
          resource={resource}
          onChange={handleChange}
        />,
      );
    }

    const view = render(
      <AutoscalingPostgresTargetFields
        resource={resource}
        onChange={handleChange}
      />,
    );

    await user.click(
      screen.getByRole("combobox", {
        name: "Lakebase project for autoscaling-lakebase",
      }),
    );
    await user.click(await screen.findByRole("option", { name: "Project One" }));

    await user.click(
      screen.getByRole("combobox", {
        name: "Branch for autoscaling-lakebase",
      }),
    );
    await user.click(
      await screen.findByRole("option", { name: /branch-main \(default\)/i }),
    );

    await user.click(
      screen.getByRole("combobox", {
        name: "Database for autoscaling-lakebase",
      }),
    );
    await user.click(
      await screen.findByRole("option", { name: "databricks_postgres" }),
    );

    expect(onChange).toHaveBeenLastCalledWith({
      name: "autoscaling-lakebase",
      description: "",
      postgres: {
        permission: "CAN_CONNECT_AND_CREATE",
        branch: "projects/project-one/branches/branch-main",
        database: buildAutoscalingPostgresDatabasePath(
          "project-one",
          "branch-main",
          "db-one",
        ),
      },
    });
  });
});
