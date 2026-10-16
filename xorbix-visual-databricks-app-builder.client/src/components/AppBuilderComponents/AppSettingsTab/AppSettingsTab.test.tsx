import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppSettingsTab from "./AppSettingsTab";
import type { AppDetails } from "../../../hooks/useAppPersistence";
import { DatabricksConnection } from "../../../models";

const baseDetails: AppDetails = {
  appName: "My app",
  databricksAppName: "db-app",
  description: "desc",
  workspacePath: "/Workspace/Users/test/app",
  workspaceConnectionId: "1",
  version: 1,
  customModulesCode: "",
};

const sharedSettingsProps = {
  workspaceConnections: [
    new DatabricksConnection({
      pkId: 1,
      workspaceDisplayName: "Workspace one",
      workspaceUrl: "https://example.one",
    }),
  ],
  normalizedResources: [],
  appSettingsWarnings: [],
  appSettingsComputeSize: "",
  databricksAppUpdateTime: "",
  resourcesLoading: false,
  resourcesError: null,
  reloadDatabricksResources: vi.fn(),
};

describe("AppSettingsTab", () => {
  it("switches tabs and renders extracted tab content", () => {
    render(
      <AppSettingsTab
        appDetails={baseDetails}
        onAppDetailsChange={vi.fn()}
        appTheme={{}}
        onAppThemeChange={vi.fn()}
        appId={1}
        {...sharedSettingsProps}
      />,
    );

    expect(screen.getByText("App name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "App Theme" }));
    expect(screen.getByText("Primary Color")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resources" }));
    expect(screen.getByText("Resources")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Permissions" }));
    expect(screen.getByText("Owner email")).toBeInTheDocument();
  });

  it("routes details and theme edits through parent callbacks", () => {
    const onAppDetailsChange = vi.fn();
    const onAppThemeChange = vi.fn();

    const { container } = render(
      <AppSettingsTab
        appDetails={baseDetails}
        onAppDetailsChange={onAppDetailsChange}
        appTheme={{}}
        onAppThemeChange={onAppThemeChange}
        appId={1}
        {...sharedSettingsProps}
      />,
    );

    fireEvent.change(screen.getByLabelText("App name"), {
      target: { value: "Renamed app" },
    });
    expect(onAppDetailsChange).toHaveBeenCalledWith({
      ...baseDetails,
      appName: "Renamed app",
    });

    fireEvent.click(screen.getByRole("button", { name: "App Theme" }));
    const primaryColorInput = container.querySelector(
      'input[type="color"]',
    ) as HTMLInputElement;
    fireEvent.change(primaryColorInput, {
      target: { value: "#123456" },
    });
    expect(onAppThemeChange).toHaveBeenCalledWith({ primaryColor: "#123456" });
  });
});
