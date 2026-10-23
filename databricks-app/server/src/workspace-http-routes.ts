import type { IncomingMessage, ServerResponse } from "node:http";
import type { HttpAppOptions } from "./http-app.ts";
import {
  decodeComponentTypeSegment,
  readPageSize,
  readPageToken,
} from "./http-request-validation.ts";
import { sendJson } from "./http-responses.ts";
import { matchWorkspaceExecutionResourcesRoute } from "./workspace-execution-resources-routes.ts";
import { matchWorkspaceLakebaseProvisionedResourcesRoute } from "./workspace-lakebase-provisioned-resources-routes.ts";
import { matchWorkspaceLakebaseResourcesRoute } from "./workspace-lakebase-resources-routes.ts";
import { matchWorkspaceResourcesRoute } from "./workspace-resources-routes.ts";

const WORKSPACE_SETUP_DIAGNOSTICS_PATH = "/api/v1/setup/diagnostics";

/** Dispatches installed-workspace resource and component-catalog reads. */
export async function handleWorkspaceHttpRoute(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  method: string,
  requestUrl: URL,
  requestPath: string,
): Promise<number | null> {
  if (method === "GET" && requestPath === WORKSPACE_SETUP_DIAGNOSTICS_PATH) {
    const caller = await options.identityResolver(request);
    const diagnostics =
      await options.workspaceSetupDiagnosticsService.getDiagnostics(caller);
    response.setHeader("cache-control", "no-store");
    sendJson(response, 200, diagnostics);
    return 200;
  }

  if (method === "GET" && requestPath === WORKSPACE_APPS_PATH) {
    const caller = await options.identityResolver(request);
    const pageSize = readPageSize(requestUrl.searchParams.get("pageSize"));
    const pageToken = readPageToken(requestUrl.searchParams.get("pageToken"));
    const apps = await options.workspaceAppsService.listApps(caller, {
      pageSize,
      pageToken,
    });
    sendJson(response, 200, apps);
    return 200;
  }

  const executionRoute = matchWorkspaceExecutionResourcesRoute(
    method,
    requestUrl,
  );
  if (executionRoute) {
    const caller = await options.identityResolver(request);
    const resources =
      executionRoute.type === "jobs"
        ? await options.workspaceExecutionResourcesService.listJobs(caller)
        : await options.workspaceExecutionResourcesService.listSqlWarehouses(
            caller,
          );
    sendJson(response, 200, resources);
    return 200;
  }

  const lakebaseRoute = matchWorkspaceLakebaseResourcesRoute(
    method,
    requestUrl,
  );
  if (lakebaseRoute) {
    const caller = await options.identityResolver(request);
    const resources =
      lakebaseRoute.type === "projects"
        ? await options.workspaceLakebaseResourcesService.listProjects(caller)
        : lakebaseRoute.type === "branches"
          ? await options.workspaceLakebaseResourcesService.listBranches(
              caller,
              lakebaseRoute.projectId,
            )
          : lakebaseRoute.type === "endpoints"
            ? await options.workspaceLakebaseResourcesService.listEndpoints(
                caller,
                lakebaseRoute.projectId,
                lakebaseRoute.branchId,
              )
            : lakebaseRoute.type === "databases"
              ? await options.workspaceLakebaseResourcesService.listDatabases(
                  caller,
                  lakebaseRoute.projectId,
                  lakebaseRoute.branchId,
                )
              : lakebaseRoute.type === "schemas"
                ? await options.workspaceLakebaseResourcesService.listSchemas(
                    caller,
                    lakebaseRoute.projectId,
                    lakebaseRoute.branchId,
                    lakebaseRoute.endpointId,
                    lakebaseRoute.databaseName,
                  )
                : await options.workspaceLakebaseResourcesService.listTables(
                    caller,
                    lakebaseRoute.projectId,
                    lakebaseRoute.branchId,
                    lakebaseRoute.endpointId,
                    lakebaseRoute.databaseName,
                    lakebaseRoute.schemaName,
                  );
    sendJson(response, 200, resources);
    return 200;
  }

  const provisionedRoute = matchWorkspaceLakebaseProvisionedResourcesRoute(
    method,
    requestUrl,
  );
  if (provisionedRoute) {
    const caller = await options.identityResolver(request);
    const resources =
      provisionedRoute.type === "instances"
        ? await options.workspaceLakebaseProvisionedResourcesService.listInstances(
            caller,
          )
        : provisionedRoute.type === "schemas"
          ? await options.workspaceLakebaseProvisionedResourcesService.listSchemas(
              caller,
              provisionedRoute.instanceName,
              provisionedRoute.databaseName,
            )
          : await options.workspaceLakebaseProvisionedResourcesService.listTables(
              caller,
              provisionedRoute.instanceName,
              provisionedRoute.databaseName,
              provisionedRoute.schemaName,
            );
    sendJson(response, 200, resources);
    return 200;
  }

  const workspaceRoute = matchWorkspaceResourcesRoute(method, requestUrl);
  if (workspaceRoute) {
    const caller = await options.identityResolver(request);
    const resources =
      workspaceRoute.type === "genieSpaces"
        ? await options.workspaceResourcesService.listGenieSpaces(caller)
        : workspaceRoute.type === "servingEndpoints"
          ? await options.workspaceResourcesService.listServingEndpoints(caller)
          : workspaceRoute.type === "catalogs"
            ? await options.workspaceResourcesService.listCatalogs(caller)
            : workspaceRoute.type === "schemas"
              ? await options.workspaceResourcesService.listSchemas(
                  caller,
                  workspaceRoute.catalogName,
                )
              : workspaceRoute.type === "volumes"
                ? await options.workspaceResourcesService.listVolumes(
                    caller,
                    workspaceRoute.catalogName,
                    workspaceRoute.schemaName,
                  )
                : await options.workspaceResourcesService.listTables(
                    caller,
                    workspaceRoute.catalogName,
                    workspaceRoute.schemaName,
                  );
    sendJson(response, 200, resources);
    return 200;
  }

  if (method === "GET" && requestPath === COMPONENT_DEFINITIONS_PATH) {
    await options.identityResolver(request);
    sendJson(response, 200, options.componentRegistryService.getRegistry());
    return 200;
  }

  const componentRoute = requestPath.match(
    /^\/api\/v1\/component-definitions\/([^/]+)$/,
  );
  if (method === "GET" && componentRoute) {
    await options.identityResolver(request);
    sendJson(
      response,
      200,
      options.componentRegistryService.getDefinition(
        decodeComponentTypeSegment(componentRoute[1]),
      ),
    );
    return 200;
  }

  return null;
}

const WORKSPACE_APPS_PATH = "/api/v1/workspace/apps";
const COMPONENT_DEFINITIONS_PATH = "/api/v1/component-definitions";
