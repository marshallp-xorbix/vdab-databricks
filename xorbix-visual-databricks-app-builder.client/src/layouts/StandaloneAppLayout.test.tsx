import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import StandaloneAppLayout from "./StandaloneAppLayout";

vi.mock("../components/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Toggle theme</button>,
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
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Workspace apps" })).toHaveAttribute(
      "href",
      "/workspace/apps",
    );
    expect(screen.getByRole("link", { name: "Workspace setup" })).toHaveAttribute(
      "href",
      "/databricks",
    );
    expect(screen.getByText("Project list content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#page-content",
    );
  });
});
