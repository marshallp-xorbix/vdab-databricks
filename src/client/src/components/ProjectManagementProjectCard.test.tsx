import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { Project } from "../models/Project";
import { useProjectAppStatus } from "../hooks/useProjectAppStatus";
import ProjectManagementProjectCard from "./ProjectManagementProjectCard";

vi.mock("../hooks/useProjectAppStatus", () => ({
  useProjectAppStatus: vi.fn(),
}));
vi.mock("./ProjectDeleteAction", () => ({ default: () => null }));
const runtimeUrl = "https://parity-demo-123.aws.databricksapps.com";
beforeEach(() =>
  vi
    .mocked(useProjectAppStatus)
    .mockReturnValue({
      childApp: {
        appId: "app-one",
        appName: "parity-demo",
        mode: "createNew",
        sourceCodePath: null,
      },
      app: {
        name: "parity-demo",
        description: null,
        url: runtimeUrl,
        appState: "RUNNING",
        computeState: "ACTIVE",
      },
      isOnline: true,
      status: "Online",
    }),
);

function renderCard() {
  render(
    <MemoryRouter>
      <ul>
        <ProjectManagementProjectCard
          project={
            new Project({
              id: "project-one",
              name: "Parity demo",
              updatedAt: "2026-10-29T00:00:00Z",
            })
          }
          isExporting={false}
          onExport={vi.fn()}
        />
      </ul>
    </MemoryRouter>,
  );
}

it("ProjectCard_RunningChildApp_OpensRuntimeAndReportsOnline", () => {
  renderCard();
  expect(screen.getByText("Online")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
    "href",
    runtimeUrl,
  );
  expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
    "href",
    "/apps/project-one",
  );
  expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute(
    "href",
    "/apps/project-one?section=settings&settings=resources#project-deployment",
  );
});

it("ProjectCard_UndeployedChildApp_DisablesRuntimeOpen", () => {
  vi.mocked(useProjectAppStatus).mockReturnValue({
    childApp: undefined,
    app: undefined,
    isOnline: false,
    status: "Not deployed",
  });
  renderCard();
  expect(screen.getByText("Not deployed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
});
