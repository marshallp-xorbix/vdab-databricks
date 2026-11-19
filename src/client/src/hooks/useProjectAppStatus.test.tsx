import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getProjectDeploymentHistory } from "../api/projectDeploymentsApi";
import { getWorkspaceApp } from "../api/workspaceAppsApi";
import { useProjectAppStatus } from "./useProjectAppStatus";

vi.mock("../api/projectDeploymentsApi", () => ({
  getProjectDeploymentHistory: vi.fn(),
  getProjectDeployment: vi.fn(),
}));
vi.mock("../api/workspaceAppsApi", () => ({
  getWorkspaceApp: vi.fn(),
  startWorkspaceApp: vi.fn(),
  stopWorkspaceApp: vi.fn(),
}));

const historyMock = vi.mocked(getProjectDeploymentHistory);
const workspaceAppMock = vi.mocked(getWorkspaceApp);

afterEach(() => {
  vi.clearAllMocks();
});

function renderStatus(
  projectId: string,
  target?: { appName: string; mode: "createNew" | "linkExisting" } | null,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProjectAppStatus(projectId, target), { wrapper });
}

describe("useProjectAppStatus", () => {
  it("shows Starting while a new App target is still provisioning", async () => {
    historyMock.mockResolvedValue({ childApp: null, items: [] });
    workspaceAppMock.mockRejectedValue(new Error("App not found"));

    const { result } = renderStatus("project-1", {
      appName: "new-app",
      mode: "createNew",
    });

    await waitFor(() => expect(result.current.status).toBe("Starting"));
  });

  it("shows the linked App compute status from the workspace", async () => {
    historyMock.mockResolvedValue({
      childApp: {
        appId: "app-1",
        appName: "linked-app",
        mode: "linkExisting",
        sourceCodePath: null,
      },
      items: [],
    });
    workspaceAppMock.mockResolvedValue({
      name: "linked-app",
      description: null,
      url: "https://linked.example.invalid",
      appState: "RUNNING",
      computeState: "ACTIVE",
    });

    const { result } = renderStatus("project-1", {
      appName: "linked-app",
      mode: "linkExisting",
    });

    await waitFor(() => expect(result.current.status).toBe("Online"));
  });

  it("keeps Draft when no child App or deployment target exists", async () => {
    historyMock.mockResolvedValue({ childApp: null, items: [] });

    const { result } = renderStatus("project-1");

    await waitFor(() => expect(result.current.status).toBe("Draft"));
  });
});
