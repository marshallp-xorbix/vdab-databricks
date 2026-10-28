import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

/** Creates the install-local route tree for the Databricks App runtime. */
export default function createDatabricksRoutes(): RouteConfig {
  return [
    layout("layouts/StandaloneAppLayout.tsx", { id: "standalone-app-layout" }, [
      index("pages/StandaloneProjectsHomeRoute.tsx"),
      route("apps", "pages/ProjectManagementRoute.tsx", { id: "apps-list" }),
      route("apps/:appId", "pages/ProjectEditorRoute.tsx", {
        id: "app-builder",
      }),
      route("workspace/apps", "pages/WorkspaceAppsPage.tsx", {
        id: "workspace-apps",
      }),
      route("databricks", "pages/WorkspaceSetupPage.tsx", {
        id: "workspace-setup",
      }),
    ]),
  ];
}
