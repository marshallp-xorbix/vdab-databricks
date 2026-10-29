import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { IProject } from "../models/Project";
import {
  createProject,
  deleteProject,
  exportProject,
  importProject,
  listProjects,
} from "../api/projectsApi";
import ProjectManagementPage from "./ProjectManagementPage";

vi.mock("../api/projectsApi", () => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  exportProject: vi.fn(),
  importProject: vi.fn(),
  listProjects: vi.fn(),
}));

const createProjectMock = vi.mocked(createProject);
const deleteProjectMock = vi.mocked(deleteProject);
const exportProjectMock = vi.mocked(exportProject);
const importProjectMock = vi.mocked(importProject);
const listProjectsMock = vi.mocked(listProjects);

const project: IProject = {
  id: "project-1",
  name: "Revenue dashboard",
  description: "Finance team",
  version: 1,
  createdBy: "user-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function renderProjectManagementPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/", element: <ProjectManagementPage /> },
      { path: "/apps/:appId", element: <h1>Project editor route</h1> },
    ],
    { initialEntries: ["/"] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

describe("ProjectManagementPage", () => {
  it("shows loading and empty project states", async () => {
    listProjectsMock.mockResolvedValueOnce({ items: [] });

    renderProjectManagementPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading projects");
    expect(
      await screen.findByRole("heading", { name: "No apps yet" }),
    ).toBeInTheDocument();
  });

  it("lists projects and opens the selected project", async () => {
    listProjectsMock.mockResolvedValue({ items: [project] });

    const router = renderProjectManagementPage();
    fireEvent.click(
      await screen.findByRole("link", { name: "Revenue dashboard" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Project editor route" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/apps/project-1");
  });

  it("creates a project and opens its editor", async () => {
    listProjectsMock.mockResolvedValue({ items: [] });
    createProjectMock.mockResolvedValue(project);

    const router = renderProjectManagementPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Create New App" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Databricks App" }));
    await userEvent.click(screen.getByRole("option", { name: "Create new Databricks App" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("App name"), {
      target: { value: "Revenue dashboard" },
    });
    fireEvent.change(
      screen.getByLabelText("Description", { selector: "textarea" }),
      {
        target: { value: "Finance team" },
      },
    );
    fireEvent.change(screen.getByLabelText("New Databricks App name"), {
      target: { value: "revenue-dashboard" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(createProjectMock).toHaveBeenCalled());
    expect(createProjectMock.mock.calls[0]?.[0]).toEqual({
      name: "Revenue dashboard",
      description: "Finance team",
    });
    expect(
      await screen.findByRole("heading", { name: "Project editor route" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/apps/project-1"),
    );
  });

  it("shows project-list errors", async () => {
    listProjectsMock.mockRejectedValueOnce(new Error("Project access denied."));

    renderProjectManagementPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Project access denied.",
    );
  });

  it("imports a portable bundle and explains required resource reselection", async () => {
    listProjectsMock.mockResolvedValue({ items: [] });
    importProjectMock.mockResolvedValue({
      project,
      requiresChildAppSelection: true,
      unresolvedResources: [
        { key: "resource_1", kind: "sqlWarehouse", label: "Shared warehouse" },
      ],
    });
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value: vi
        .fn()
        .mockResolvedValue(
          JSON.stringify({ format: "vdab-project", schemaVersion: 1 }),
        ),
    });

    renderProjectManagementPage();
    await userEvent.click(
      screen.getByRole("button", { name: "Project import and export actions" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Import a standalone project…" }),
    );
    fireEvent.change(await screen.findByLabelText("Project JSON file"), {
      target: {
        files: [
          new File(["{}"], "project.vdab.json", { type: "application/json" }),
        ],
      },
    });

    expect(await screen.findByText(/Imported/)).toBeInTheDocument();
    expect(
      screen.getByText("sqlWarehouse: Shared warehouse"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Choose a child App before deploying/),
    ).toBeInTheDocument();
    expect(importProjectMock.mock.calls[0]?.[0]).toEqual({
      format: "vdab-project",
      schemaVersion: 1,
    });
  });

  it("rejects an oversized project file before reading or uploading it", async () => {
    listProjectsMock.mockResolvedValue({ items: [] });
    const textMock = vi.fn();
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value: textMock,
    });
    const oversizedFile = new File(["{}"], "large-project.vdab.json", {
      type: "application/json",
    });
    Object.defineProperty(oversizedFile, "size", { value: 1_048_577 });

    renderProjectManagementPage();
    await userEvent.click(
      screen.getByRole("button", { name: "Project import and export actions" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Import a standalone project…" }),
    );
    const importInput = await screen.findByLabelText("Project JSON file");
    fireEvent.change(importInput, { target: { files: [oversizedFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "smaller than 1 MiB",
    );
    expect(importInput).toHaveAttribute("aria-invalid", "true");
    expect(importInput).toHaveAttribute(
      "aria-describedby",
      "project-import-help project-import-error",
    );
    expect(textMock).not.toHaveBeenCalled();
    expect(importProjectMock).not.toHaveBeenCalled();
  });

  it("exports a project through the standalone portability endpoint", async () => {
    const user = userEvent.setup();
    listProjectsMock.mockResolvedValueOnce({ items: [project] });
    exportProjectMock.mockResolvedValue({
      format: "vdab-project",
      schemaVersion: 1,
      exportedAt: "2026-10-20T00:00:00.000Z",
      project: { name: project.name },
    });
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:test"),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    renderProjectManagementPage();
    await user.click(
      await screen.findByRole("button", {
        name: "Actions for Revenue dashboard",
      }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Export project" }));

    await waitFor(() =>
      expect(exportProjectMock.mock.calls[0]?.[0]).toBe(project.id),
    );
  });

  it("confirms owner deletion and refreshes the visible project list", async () => {
    listProjectsMock.mockResolvedValue({ items: [project] });
    deleteProjectMock.mockResolvedValue(undefined);

    renderProjectManagementPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for Revenue dashboard" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete project" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "cannot be undone in the app",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "child App and its workspace source files will remain",
    );
    expect(deleteProjectMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove project" }));

    await waitFor(() =>
      expect(deleteProjectMock.mock.calls[0]?.[0]).toBe(project.id),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not offer project deletion to an editor", async () => {
    listProjectsMock.mockResolvedValue({
      items: [{ ...project, callerRole: "editor" }],
    });

    renderProjectManagementPage();

    expect(
      await screen.findByRole("link", { name: "Revenue dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete project" }),
    ).not.toBeInTheDocument();
  });
});
