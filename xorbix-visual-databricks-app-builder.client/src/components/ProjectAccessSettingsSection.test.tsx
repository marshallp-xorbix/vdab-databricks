import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectAccessSettingsSection from "./ProjectAccessSettingsSection";

vi.mock("../hooks/useWorkspaceSession", () => ({
  useWorkspaceSession: () => ({
    data: {
      userId: "72836997780449@7474660596586412",
      email: "patrick.wayne.marshall@gmail.com",
    },
  }),
}));

vi.mock("./ProjectCollaboratorsEditor", () => ({
  default: () => <p>Editor access list</p>,
}));

describe("ProjectAccessSettingsSection", () => {
  it("shows the signed-in project owner by email and separates editor access", () => {
    render(
      <ProjectAccessSettingsSection
        projectId="project-1"
        projectOwnerUserId="72836997780449@7474660596586412"
        canManageCollaborators={true}
      />,
    );

    expect(screen.getByRole("heading", { name: "Owner" })).toBeInTheDocument();
    expect(screen.getByText("patrick.wayne.marshall@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Editor access list")).toBeInTheDocument();
  });

  it("keeps unknown owners identified by their trusted workspace user ID", () => {
    render(
      <ProjectAccessSettingsSection
        projectId="project-1"
        projectOwnerUserId="72836997780450@7474660596586412"
        canManageCollaborators={false}
      />,
    );

    expect(
      screen.getByText("72836997780450@7474660596586412"),
    ).toBeInTheDocument();
    expect(screen.getByText(/managed by the owner/i)).toBeInTheDocument();
    expect(screen.queryByText("Editor access list")).not.toBeInTheDocument();
  });
});
