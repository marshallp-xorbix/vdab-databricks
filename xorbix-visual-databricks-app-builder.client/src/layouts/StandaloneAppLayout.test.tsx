import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import StandaloneAppLayout from "./StandaloneAppLayout";

vi.mock("../components/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Toggle theme</button>,
}));

vi.mock("../hooks/useProject", () => ({
  useProject: () => ({ data: { name: "Test app" } }),
}));

vi.mock("../hooks/useWorkspaceSession", () => ({
  useWorkspaceSession: () => ({
    data: { preferredUsername: null, email: "patrick.wayne.marshall@gmail.com" },
  }),
}));

describe("StandaloneAppLayout", () => {
  it("renders standalone navigation and the nested route content", () => {
    render(
      <MemoryRouter initialEntries={["/apps"]}>
        <Routes>
          <Route element={<StandaloneAppLayout />}>
            <Route path="/apps" element={<p>Project list content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
    const mainNavigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });
    expect(within(mainNavigation).getByRole("link", { name: "Apps" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(mainNavigation).getByRole("link", { name: "Workspace apps" }),
    ).toHaveAttribute("href", "/workspace/apps");
    expect(
      within(mainNavigation).getByRole("link", { name: "Workspace setup" }),
    ).toHaveAttribute("href", "/databricks");
    expect(screen.getByText("Project list content")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "VDAB" })).toHaveAttribute(
      "src",
      "/vdab%20-%20logo.png",
    );
    expect(screen.getByText("My Apps")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Signed-in Databricks user" }),
    ).toHaveTextContent("Patrick Marshall");
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#page-content",
    );
  });

  it("shows SaaS-style builder navigation for a project route", () => {
    render(
      <MemoryRouter initialEntries={["/apps/project-1?section=workflows"]}>
        <Routes>
          <Route element={<StandaloneAppLayout />}>
            <Route path="/apps/:appId" element={<p>Builder content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const builderNavigation = screen.getAllByRole("navigation", {
      name: "Builder navigation",
    })[0]!;
    expect(
      within(builderNavigation).getByRole("link", { name: "Canvas" }),
    ).toHaveAttribute("href", "/apps/project-1");
    expect(
      within(builderNavigation).getByRole("link", { name: "Workflow" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(builderNavigation).getByRole("link", { name: "Code" }),
    ).toHaveAttribute("href", "/apps/project-1?section=code");
    expect(
      within(builderNavigation).getByRole("link", { name: "Settings" }),
    ).toHaveAttribute("href", "/apps/project-1?section=settings");
    expect(screen.getAllByRole("link", { name: "Back to Apps" })[0]).toHaveAttribute(
      "href",
      "/apps",
    );
    expect(screen.getByText("Builder content")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Signed-in Databricks user" }),
    ).toHaveTextContent("Patrick Marshall");
    expect(
      screen.getByRole("group", { name: "Signed-in Databricks user" }),
    ).toHaveAttribute("title", "patrick.wayne.marshall@gmail.com");
  });
});
