import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreateAppWizardDialog from "./CreateAppWizardDialog";
import { DatabricksAppCreationMode } from "../models";

const mockGetWorkspacesByTenant = vi.fn();
const mockCreateApp = vi.fn();

vi.mock("../providers/DatabricksApi", () => ({
  databricksApi: {
    getWorkspacesByTenant: () => mockGetWorkspacesByTenant(),
  },
}));

vi.mock("../providers/AppApi", () => ({
  appApi: {
    createApp: (req: unknown) => mockCreateApp(req),
  },
}));

vi.mock("../hooks/useDatabricksAppNames", () => ({
  useDatabricksAppNames: vi.fn(() => ({
    appNames: [] as string[],
    loadState: "idle" as const,
    errorMessage: null as string | null,
  })),
}));

vi.mock("../hooks/useWorkspaceApps", () => ({
  useWorkspaceApps: vi.fn(() => ({
    data: { pages: [{ items: [{ name: "existing-child", appState: "STOPPED" }] }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  })),
}));

vi.mock("./ui/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("./AppBuilderComponents/AppSettingsTab/DatabricksAppNameCombobox", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (name: string) => void;
  }) => (
    <input
      aria-label="Databricks App Name"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("./ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      data-testid="wizard-native-select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder ?? ""}</option>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

function renderDialog(
  props: Partial<React.ComponentProps<typeof CreateAppWizardDialog>> = {},
) {
  const onOpenChange = vi.fn();
  const onCreated = vi.fn();
  render(
    <MemoryRouter>
      <CreateAppWizardDialog
        open
        onOpenChange={onOpenChange}
        onCreated={onCreated}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onOpenChange, onCreated };
}

describe("CreateAppWizardDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspacesByTenant.mockResolvedValue([
      {
        pkId: 1,
        tenantId: "t1",
        ownerId: "o1",
        workspaceDisplayName: "Workspace one",
        workspaceUrl: "https://example.one",
        createdOn: new Date().toISOString(),
      },
    ]);
 });

  it("disables Next on workspace step until a workspace is chosen", async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockGetWorkspacesByTenant).toHaveBeenCalled();
      expect(screen.getAllByTestId("wizard-native-select").length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByTestId("wizard-native-select");
    const workspaceSelect = selects[0];
    expect(workspaceSelect).toBeTruthy();

    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();

    fireEvent.change(workspaceSelect, { target: { value: "1" } });
    expect(next).not.toBeDisabled();
  });

  it("link path: submit calls createApp with linkExisting and selected Databricks name", async () => {
    const { useDatabricksAppNames } = await import("../hooks/useDatabricksAppNames");
    vi.mocked(useDatabricksAppNames).mockImplementation((_appId, workspaceId) => {
      if (workspaceId === 1) {
        return {
          appNames: ["existing-app"],
          loadState: "success",
          errorMessage: null,
        };
      }
      return { appNames: [], loadState: "idle", errorMessage: null };
    });

    mockCreateApp.mockResolvedValue({
      id: 99,
      appName: "VDAB",
      createdOn: new Date().toISOString(),
      workspaceConnectionId: 1,
      ownerId: "u1",
      version: 1,
      databricksAppName: "existing-app",
    });

    renderDialog();

    await waitFor(() => {
      expect(screen.getAllByTestId("wizard-native-select").length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByTestId("wizard-native-select");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("VDAB App Name"), {
      target: { value: "My VDAB app" },
    });
    fireEvent.change(screen.getByLabelText("Databricks App Name"), {
      target: { value: "existing-app" },
    });

    const createBtn = screen.getByRole("button", { name: "Create app" });
    expect(createBtn).not.toBeDisabled();
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockCreateApp).toHaveBeenCalledTimes(1);
    });

    const payload = mockCreateApp.mock.calls[0][0];
    expect(payload.databricksAppMode).toBe(DatabricksAppCreationMode.LinkExisting);
    expect(payload.databricksAppName).toBe("existing-app");
    expect(payload.workspaceConnectionId).toBe(1);
    expect(payload.appName).toBe("My VDAB app");
  });

  it("create-new path: createApp receives createNew and new Databricks name", async () => {
    mockCreateApp.mockResolvedValue({
      id: 100,
      appName: "VDAB new",
      createdOn: new Date().toISOString(),
      workspaceConnectionId: 1,
      ownerId: "u1",
      version: 1,
      databricksAppName: "brand-new-dbx",
    });

    renderDialog();

    await waitFor(() => {
      expect(screen.getAllByTestId("wizard-native-select").length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByTestId("wizard-native-select");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const strategySelect = screen.getAllByTestId("wizard-native-select")[0];
    fireEvent.change(strategySelect, {
      target: { value: DatabricksAppCreationMode.CreateNew },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("VDAB App Name"), {
      target: { value: "Tenant app" },
    });
    fireEvent.change(screen.getByLabelText("New Databricks App Name"), {
      target: { value: "brand-new-dbx" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create app" }));

    await waitFor(() => {
      expect(mockCreateApp).toHaveBeenCalledTimes(1);
    });

    const payload = mockCreateApp.mock.calls[0][0];
    expect(payload.databricksAppMode).toBe(DatabricksAppCreationMode.CreateNew);
    expect(payload.databricksAppName).toBe("brand-new-dbx");
  });

  it("standalone mode pins the workspace, selects an App target, and creates a project", async () => {
    const onProjectCreated = vi.fn().mockResolvedValue(undefined);
    const { onOpenChange } = renderDialog({
      standaloneProjectMode: true,
      onProjectCreated,
    });

    expect(await screen.findByText("Databricks workspace")).toBeInTheDocument();
    expect(mockGetWorkspacesByTenant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByTestId("wizard-native-select"), {
      target: { value: "createNew" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByLabelText("App name")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("App name"), {
      target: { value: "Revenue dashboard" },
    });
    fireEvent.change(screen.getByLabelText("Description", { selector: "textarea" }), {
      target: { value: "Finance team" },
    });
    fireEvent.change(screen.getByLabelText("New Databricks App name"), {
      target: { value: "revenue-dashboard" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => {
      expect(onProjectCreated).toHaveBeenCalledWith("Revenue dashboard", "Finance team", {
        mode: "createNew",
        appName: "revenue-dashboard",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
