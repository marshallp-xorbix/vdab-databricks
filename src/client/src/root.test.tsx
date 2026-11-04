import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./root";

afterEach(() => vi.unstubAllEnvs());

describe("root ErrorBoundary", () => {
  it("keeps production route failures generic", () => {
    vi.stubEnv("DEV", false);
    const error = {
      data: "sensitive response payload",
      internal: true,
      status: 500,
      statusText: "database credential detail",
    } as Parameters<typeof ErrorBoundary>[0]["error"];

    render(ErrorBoundary({ error } as Parameters<typeof ErrorBoundary>[0]));

    expect(
      screen.getByText("An unexpected error occurred."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("database credential detail"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("sensitive response payload"),
    ).not.toBeInTheDocument();
  });

  it("keeps the not-found explanation", () => {
    const error = {
      data: "route was missing",
      internal: false,
      status: 404,
      statusText: "Not Found",
    } as Parameters<typeof ErrorBoundary>[0]["error"];

    render(ErrorBoundary({ error } as Parameters<typeof ErrorBoundary>[0]));

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(
      screen.getByText("The requested page could not be found."),
    ).toBeInTheDocument();
  });
});
