import { describe, expect, it } from "vitest";
import { createRouteConfig } from "./routes";

describe("createRouteConfig", () => {
  it("keeps the Databricks route graph independent from SaaS identity routes", () => {
    const routes = JSON.stringify(createRouteConfig(true));

    expect(routes).toContain("StandaloneAppLayout.tsx");
    expect(routes).toContain("ProjectManagementPage.tsx");
    expect(routes).toContain("ProjectEditorPage.tsx");
    expect(routes).toContain("WorkspaceSetupPage.tsx");
    expect(routes).not.toContain("AuthenticatedLayout.tsx");
    expect(routes).not.toContain("LoginPage.tsx");
    expect(routes).not.toContain("TenantManagement.tsx");
    expect(routes).not.toContain("DatabricksConnections.tsx");
  });

  it("retains the legacy route graph for the SaaS reference build", () => {
    const routes = JSON.stringify(createRouteConfig(false));

    expect(routes).toContain("AuthenticatedLayout.tsx");
    expect(routes).toContain("LoginPage.tsx");
    expect(routes).toContain("TenantManagement.tsx");
    expect(routes).toContain("DatabricksConnections.tsx");
    expect(routes).not.toContain("StandaloneAppLayout.tsx");
  });
});
