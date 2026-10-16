import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { Breadcrumb } from "./Breadcrumb";

const SAMPLE_GUID = "11111111-2222-3333-4444-555555555555";

const renderAtPath = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/apps/:appId" element={<Breadcrumb />} />
        <Route path="*" element={<Breadcrumb />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Breadcrumb", () => {
  it("shows Administration then Dashboard without a leading Apps crumb", () => {
    renderAtPath("/administration/dashboard");

    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Apps")).not.toBeInTheDocument();
  });

  it("shows the Administration > Users > User trail on a user detail page", () => {
    renderAtPath(`/administration/users/${SAMPLE_GUID}`);

    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.queryByText("Apps")).not.toBeInTheDocument();
  });

  it("shows the User Management leaf on the users index", () => {
    renderAtPath("/administration/users");

    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByText("User Management")).toBeInTheDocument();
    expect(screen.queryByText("Apps")).not.toBeInTheDocument();
  });

  it("shows the My Apps leaf on the apps index", () => {
    renderAtPath("/apps");

    expect(screen.getByText("My Apps")).toBeInTheDocument();
  });

  it("shows My Apps and the app name on an app detail page", () => {
    renderAtPath(`/apps/${SAMPLE_GUID}?name=Sales%20Dashboard`);

    expect(screen.getByText("My Apps")).toBeInTheDocument();
    expect(screen.getByText("Sales Dashboard")).toBeInTheDocument();
  });

  it("falls back to Untitled App when the app detail page has no name", () => {
    renderAtPath(`/apps/${SAMPLE_GUID}`);

    expect(screen.getByText("My Apps")).toBeInTheDocument();
    expect(screen.getByText("Untitled App")).toBeInTheDocument();
  });

  it("renders nothing for an unmapped path", () => {
    const { container } = renderAtPath("/some/unmapped/path");

    expect(container).toBeEmptyDOMElement();
  });
});
