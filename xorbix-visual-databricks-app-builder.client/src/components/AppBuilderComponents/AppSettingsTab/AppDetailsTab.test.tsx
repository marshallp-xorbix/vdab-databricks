import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import AppDetailsTab from "./AppDetailsTab";
import type { AppDetails } from "../../../hooks/useAppPersistence";
import type { IDatabricksConnection } from "../../../models";

vi.mock("./DatabricksAppNameCombobox", () => ({
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

vi.mock("../../ui/select", () => ({
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
      aria-label="workspace-connection-select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder || ""}</option>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const baseDetails: AppDetails = {
  appName: "My app",
  databricksAppName: "db-app",
  description: "desc",
  workspacePath: "/Workspace/Users/test/app",
  workspaceConnectionId: "1",
  version: 1,
  customModulesCode: "",
};

const workspaceConnections: IDatabricksConnection[] = [
  {
    pkId: 1,
    tenantId: "tenant-1",
    ownerId: "owner-1",
    workspaceDisplayName: "Workspace one",
    workspaceUrl: "https://example.one",
    createdOn: new Date().toISOString(),
  },
  {
    pkId: 2,
    tenantId: "tenant-1",
    ownerId: "owner-1",
    workspaceDisplayName: "Workspace two",
    workspaceUrl: "https://example.two",
    createdOn: new Date().toISOString(),
  },
];

describe("AppDetailsTab", () => {
  it("calls onDetailChange for text fields and textarea", () => {
    const onDetailChange = vi.fn();
    render(
      <AppDetailsTab
        appId={1}
        appDetails={baseDetails}
        workspaceConnections={[]}
        onDetailChange={onDetailChange}
        databricksAppNames={["db-app", "other"]}
        databricksAppNamesLoadState="success"
        databricksAppNamesError={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("App name"), {
      target: { value: "Renamed app" },
    });
    fireEvent.change(screen.getByLabelText("Databricks App Name"), {
      target: { value: "new-db-app" },
    });
    fireEvent.change(screen.getByLabelText("Workspace path"), {
      target: { value: "/Workspace/new/path" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "updated description" },
    });

    expect(onDetailChange).toHaveBeenCalledWith("appName", "Renamed app");
    expect(onDetailChange).toHaveBeenCalledWith(
      "databricksAppName",
      "new-db-app",
    );
    expect(onDetailChange).toHaveBeenCalledWith(
      "workspacePath",
      "/Workspace/new/path",
    );
    expect(onDetailChange).toHaveBeenCalledWith(
      "description",
      "updated description",
    );
  });

  it("calls onDetailChange when workspace connection changes", () => {
    const onDetailChange = vi.fn();
    render(
      <AppDetailsTab
        appId={1}
        appDetails={baseDetails}
        workspaceConnections={workspaceConnections}
        onDetailChange={onDetailChange}
        databricksAppNames={["db-app"]}
        databricksAppNamesLoadState="success"
        databricksAppNamesError={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("workspace-connection-select"), {
      target: { value: "2" },
    });

    expect(onDetailChange).toHaveBeenCalledWith("workspaceConnectionId", "2");
  });
});
