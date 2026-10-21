import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IWorkspaceAppsPage } from "../models/WorkspaceApp";
import { listWorkspaceApps } from "../api/workspaceAppsApi";
import WorkspaceAppsPage from "./WorkspaceAppsPage";

vi.mock("../api/workspaceAppsApi", () => ({
  listWorkspaceApps: vi.fn(),
}));

const listWorkspaceAppsMock = vi.mocked(listWorkspaceApps);

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return function QueryWrapper({
    children,
  }: Readonly<PropsWithChildren>) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function makePage(overrides: Partial<IWorkspaceAppsPage> = {}): IWorkspaceAppsPage {
  return {
    items: [],
    nextPageToken: null,
    authenticationMode: "databricks",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceAppsPage", () => {
  it("shows an accessible loading state while the first page is pending", () => {
    listWorkspaceAppsMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<WorkspaceAppsPage />, { wrapper: createQueryWrapper() });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading workspace apps",
    );
  });

  it("shows a visible error state when loading fails", async () => {
    listWorkspaceAppsMock.mockRejectedValueOnce(new Error("Access denied."));

    render(<WorkspaceAppsPage />, { wrapper: createQueryWrapper() });

    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied.");
  });

  it("shows the empty state and marks simulated local test data", async () => {
    listWorkspaceAppsMock.mockResolvedValueOnce(
      makePage({ authenticationMode: "local-test" }),
    );

    render(<WorkspaceAppsPage />, { wrapper: createQueryWrapper() });

    expect(
      await screen.findByRole("heading", { name: "No workspace apps found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Local test mode: workspace app data is simulated",
    );
  });

  it("renders workspace apps and loads the next page", async () => {
    listWorkspaceAppsMock
      .mockResolvedValueOnce(
        makePage({
          items: [
            {
              name: "sales-dashboard",
              description: "Regional sales",
              appState: "RUNNING",
              computeState: "ACTIVE",
            },
          ],
          nextPageToken: "page-2",
        }),
      )
      .mockResolvedValueOnce(
        makePage({
          items: [
            {
              name: "inventory-tool",
              description: null,
              appState: null,
              computeState: null,
            },
          ],
        }),
      );

    render(<WorkspaceAppsPage />, { wrapper: createQueryWrapper() });

    expect(
      await screen.findByRole("heading", { name: "sales-dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Regional sales")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more apps" }));

    expect(
      await screen.findByRole("heading", { name: "inventory-tool" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(listWorkspaceAppsMock).toHaveBeenCalledTimes(2));
  });
});
