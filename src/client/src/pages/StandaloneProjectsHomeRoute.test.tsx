import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import StandaloneProjectsHomeRoute from "./StandaloneProjectsHomeRoute";

describe("StandaloneProjectsHomeRoute", () => {
  it("redirects the app root to the projects route", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<StandaloneProjectsHomeRoute />} />
          <Route path="/apps" element={<p>Projects route</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Projects route")).toBeInTheDocument();
  });
});
