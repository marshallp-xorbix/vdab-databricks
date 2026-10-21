import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listProjectCollaborators,
  revokeProjectCollaborator,
} from "../api/projectCollaboratorsApi";
import ProjectCollaboratorsEditor from "./ProjectCollaboratorsEditor";

vi.mock("../api/projectCollaboratorsApi", () => ({
  listProjectCollaborators: vi.fn(),
  revokeProjectCollaborator: vi.fn(),
}));

const listCollaboratorsMock = vi.mocked(listProjectCollaborators);
const revokeCollaboratorMock = vi.mocked(revokeProjectCollaborator);
const editorGrant = {
  userId: "editor@example.com",
  role: "editor" as const,
  grantedBy: "owner@example.com",
  createdAt: "2026-10-20T00:00:00.000Z",
};

afterEach(() => vi.clearAllMocks());

beforeEach(() => {
  listCollaboratorsMock.mockResolvedValue([editorGrant]);
  revokeCollaboratorMock.mockResolvedValue(undefined);
});

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectCollaboratorsEditor projectId="project-1" />
    </QueryClientProvider>,
  );
}

describe("ProjectCollaboratorsEditor", () => {
  it("loads grants and asks for confirmation before removal", async () => {
    renderEditor();

    expect(await screen.findByText("editor@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove access for editor@example.com" }));

    expect(screen.getByText("Remove this person’s project access?")).toBeInTheDocument();
    expect(revokeCollaboratorMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));

    await waitFor(() => expect(revokeCollaboratorMock.mock.calls[0]?.[0]).toEqual({
      projectId: "project-1",
      userId: "editor@example.com",
    }));
  });

  it("allows cancelling a pending removal", async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Remove access for editor@example.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Remove access for editor@example.com" })).toBeInTheDocument();
    expect(revokeCollaboratorMock).not.toHaveBeenCalled();
  });
});
