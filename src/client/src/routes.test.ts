import { describe, expect, it } from "vitest";
import createDatabricksRoutes from "./route-config/databricksRoutes";

describe("installed App route graph", () => {
  it("exposes only the workspace-native builder routes", () => {
    const routes = JSON.stringify(createDatabricksRoutes());

    expect(routes).toContain("StandaloneAppLayout.tsx");
    expect(routes).toContain("ProjectManagementPage.tsx");
    expect(routes).toContain("ProjectEditorPage.tsx");
    expect(routes).toContain("WorkspaceSetupPage.tsx");
    expect(routes).toContain("WorkspaceAppsPage.tsx");
  });
});
