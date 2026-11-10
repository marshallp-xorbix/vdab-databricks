import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startProjectDeployment } from "../api/projectDeploymentsApi";
import { getWorkspaceApp } from "../api/workspaceAppsApi";
import { deploySavedProjectAndOpen } from "./deploySavedProject";

vi.mock("../api/projectDeploymentsApi", () => ({
  startProjectDeployment: vi.fn(),
}));
vi.mock("../api/workspaceAppsApi", () => ({
  getWorkspaceApp: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(startProjectDeployment).mockResolvedValue({
    id: "deployment-1",
  } as never);
  vi.stubGlobal("open", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("DeploySavedProject_OpensChildAppInNewTabWhenUrlReady", async () => {
  vi.mocked(getWorkspaceApp).mockResolvedValue({
    url: "https://child.example.com/",
  } as never);

  const result = await deploySavedProjectAndOpen({
    projectId: "project-one",
    mode: "createNew",
    appName: "parity-demo",
    secretResources: [{ name: "api", scope: "scope", key: "key" }],
  });

  expect(startProjectDeployment).toHaveBeenCalledWith({
    projectId: "project-one",
    mode: "createNew",
    appName: "parity-demo",
    confirmOverwrite: true,
    secretResources: [{ name: "api", scope: "scope", key: "key" }],
  });
  expect(result).toEqual({
    status: "opened",
    url: "https://child.example.com/",
  });
  expect(window.open).toHaveBeenCalledWith(
    "https://child.example.com/",
    "_blank",
    "noopener,noreferrer",
  );
});

it("DeploySavedProject_StaysInBuilderWhenUrlNeverArrives", async () => {
  vi.useFakeTimers();
  vi.mocked(getWorkspaceApp).mockResolvedValue({ url: null } as never);

  const pending = deploySavedProjectAndOpen({
    projectId: "project-one",
    mode: "createNew",
    appName: "parity-demo",
  });
  await vi.advanceTimersByTimeAsync(30 * 2_000);
  await expect(pending).resolves.toEqual({ status: "started_without_url" });
  expect(window.open).not.toHaveBeenCalled();
});
