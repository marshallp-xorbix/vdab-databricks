import type { IncomingMessage, ServerResponse } from "node:http";
import { ApplicationError } from "./application-error.ts";
import type { HttpAppOptions } from "./http-app.ts";
import {
  decodePathSegment,
  parseJsonRequestBody,
  requireEmptyRequestBody,
} from "./http-request-validation.ts";
import { sendJson } from "./http-responses.ts";
import { matchProjectDeploymentRoute } from "./project-deployment-routes.ts";

/** Handles workspace App targeting and the caller-authorized deployment API. */
export async function handleProjectDeploymentHttpRoute(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  requestId: string,
  method: string,
  requestUrl: URL,
  requestPath: string,
  requestBody: string,
): Promise<number | null> {
  const appTarget = requestPath.match(
    /^\/api\/v1\/workspace\/apps\/([^/]+)\/deployment-target$/,
  );
  if (method === "GET" && appTarget) {
    requireEmptyRequestBody(
      requestBody,
      "deployment_target_body_not_supported",
      "Workspace App detail requests do not accept a request body.",
    );
    if (requestUrl.search !== "") {
      throw new ApplicationError(
        400,
        "invalid_deployment_target_request",
        "Invalid App target request",
        "Workspace App detail requests do not accept query parameters.",
      );
    }

    const deploymentService = requireDeploymentService(options);
    const appName = decodeWorkspaceAppName(appTarget[1]);
    const caller = await options.identityResolver(request);
    const target = await deploymentService.getWorkspaceAppDeploymentTarget(
      caller,
      appName,
    );
    sendJson(response, 200, target);
    return 200;
  }

  const route = matchProjectDeploymentRoute(method, requestPath);
  if (!route) return null;
  const deploymentService = requireDeploymentService(options);
  const caller = await options.identityResolver(request);
  const projectId = decodePathSegment(route.projectId);

  if (route.type === "readiness") {
    requireEmptyRequestBody(
      requestBody,
      "deployment_readiness_body_not_supported",
      "Deployment readiness requests do not accept a request body.",
    );
    if (requestUrl.search !== "") {
      throw new ApplicationError(
        400,
        "invalid_deployment_readiness_request",
        "Invalid deployment readiness request",
        "Deployment readiness requests do not accept query parameters.",
      );
    }
    sendJson(
      response,
      200,
      await deploymentService.getReadiness(caller, requestId, projectId),
    );
    return 200;
  }

  if (route.type === "history") {
    requireEmptyRequestBody(
      requestBody,
      "deployment_history_body_not_supported",
      "Deployment history does not accept a request body.",
    );
    sendJson(
      response,
      200,
      await deploymentService.listHistory(caller, requestId, projectId),
    );
    return 200;
  }

  if (route.type === "start") {
    sendJson(
      response,
      201,
      await deploymentService.deploy(
        caller,
        requestId,
        projectId,
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      ),
    );
    return 201;
  }

  if (route.type === "deployment") {
    requireEmptyRequestBody(
      requestBody,
      "deployment_status_body_not_supported",
      "Deployment status does not accept a request body.",
    );
    sendJson(
      response,
      200,
      await deploymentService.getDeployment(
        caller,
        requestId,
        projectId,
        route.deploymentId,
      ),
    );
    return 200;
  }

  const body = parseJsonRequestBody(
    requestBody,
    request.headers["content-type"],
  );
  const result =
    route.type === "retry"
      ? await deploymentService.retry(
          caller,
          requestId,
          projectId,
          route.deploymentId,
          body,
        )
      : await deploymentService.rollback(
          caller,
          requestId,
          projectId,
          route.deploymentId,
          body,
        );
  sendJson(response, 202, result);
  return 202;
}

function requireDeploymentService(options: HttpAppOptions) {
  if (!options.projectDeploymentService) {
    throw new ApplicationError(
      503,
      "child_app_deployment_unavailable",
      "Child App deployment unavailable",
      "Child App deployment is available only in the installed Databricks workspace.",
    );
  }
  return options.projectDeploymentService;
}

function decodeWorkspaceAppName(value: string | undefined): string {
  try {
    return decodeURIComponent(value ?? "");
  } catch {
    throw new ApplicationError(
      400,
      "invalid_child_app_name",
      "Invalid Databricks App name",
      "Select a valid App from the installed workspace.",
    );
  }
}
