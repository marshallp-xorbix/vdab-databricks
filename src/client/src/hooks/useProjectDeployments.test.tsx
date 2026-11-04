import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IProjectDeploymentSummary } from "../models/ProjectDeployments";
import { getProjectDeployment } from "../api/projectDeploymentsApi";
import { useProjectDeployment } from "./useProjectDeployments";

vi.mock("../api/projectDeploymentsApi", () => ({
  getProjectDeployment: vi.fn(),
  getProjectDeploymentHistory: vi.fn(),
}));

const getDeploymentMock = vi.mocked(getProjectDeployment);

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useProjectDeployment", () => {
  it("keeps polling a pending record before Databricks returns a deployment id", async () => {
    vi.useFakeTimers();
    const deployment: IProjectDeploymentSummary = {
      id: "deployment-record-id",
      projectId: "project-id",
      appName: "demo-app",
      mode: "createNew",
      sourceVersion: 1,
      status: "pending",
      deploymentId: null,
      sourceCodePath: "/Workspace/Users/demo/app",
      failureCode: null,
      attemptOf: null,
      createdAt: "2026-11-02T12:00:00.000Z",
      completedAt: null,
    };
    getDeploymentMock.mockResolvedValue(deployment);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useProjectDeployment("project-id", deployment), {
      wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(getDeploymentMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    queryClient.clear();
  });
});
