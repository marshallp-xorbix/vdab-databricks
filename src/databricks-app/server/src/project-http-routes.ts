import type { IncomingMessage, ServerResponse } from "node:http";
import { ApplicationError } from "./application-error.ts";
import type { HttpAppOptions } from "./http-app.ts";
import {
  decodeCollaboratorPathSegment,
  decodePathSegment,
  parseJsonRequestBody,
  requireEmptyRequestBody,
} from "./http-request-validation.ts";
import { sendJson } from "./http-responses.ts";
import { handleAiBuilderHttpRoute } from "./ai-builder-http-route.ts";
import { handleProjectDeploymentHttpRoute } from "./project-deployment-http-routes.ts";

/** Dispatches project, collaboration, and deployment API requests. */
export async function handleProjectHttpRoute(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  requestId: string,
  method: string,
  requestUrl: URL,
  requestPath: string,
  requestBody: string,
): Promise<number | null> {
  const deploymentStatus = await handleProjectDeploymentHttpRoute(
    request,
    response,
    options,
    requestId,
    method,
    requestUrl,
    requestPath,
    requestBody,
  );
  if (deploymentStatus !== null) return deploymentStatus;

  if (
    await handleProjectDataRoute(
      request,
      response,
      options,
      requestId,
      method,
      requestUrl,
      requestPath,
      requestBody,
    )
  ) {
    return response.statusCode;
  }
  return null;
}

async function handleProjectDataRoute(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  requestId: string,
  method: string,
  requestUrl: URL,
  requestPath: string,
  requestBody: string,
): Promise<boolean> {
  if (method === "GET" && requestPath === "/api/v1/projects") {
    const caller = await options.identityResolver(request);
    const projects = await options.projectService.listProjects(
      caller,
      requestId,
    );
    sendJson(response, 200, { items: projects });
    return true;
  }
  if (method === "POST" && requestPath === "/api/v1/projects/import") {
    const caller = await options.identityResolver(request);
    const imported = await options.projectPortabilityService.importProject(
      caller,
      requestId,
      parseJsonRequestBody(requestBody, request.headers["content-type"]),
    );
    sendJson(response, 201, imported);
    return true;
  }
  if (method === "POST" && requestPath === "/api/v1/projects") {
    const caller = await options.identityResolver(request);
    const project = await options.projectService.createProject(
      caller,
      requestId,
      parseJsonRequestBody(requestBody, request.headers["content-type"]),
    );
    sendJson(response, 201, project);
    return true;
  }
  if (
    await handleProjectMetadataRoute(
      request,
      response,
      options,
      requestId,
      method,
      requestUrl,
      requestPath,
      requestBody,
    )
  )
    return true;
  if (
    await handleProjectDocumentRoutes(
      request,
      response,
      options,
      requestId,
      method,
      requestPath,
      requestBody,
    )
  )
    return true;
  if (
    await handleProjectPreviewRoute(
      request,
      response,
      options,
      requestId,
      method,
      requestPath,
      requestBody,
    )
  )
    return true;
  return handleCollaboratorRoutes(
    request,
    response,
    options,
    requestId,
    method,
    requestPath,
    requestBody,
  );
}

async function handleProjectMetadataRoute(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  requestId: string,
  method: string,
  requestUrl: URL,
  requestPath: string,
  requestBody: string,
): Promise<boolean> {
  const exportMatch = requestPath.match(
    /^\/api\/v1\/projects\/([^/]+)\/export$/,
  );
  if (method === "GET" && exportMatch) {
    const caller = await options.identityResolver(request);
    const exported = await options.projectPortabilityService.exportProject(
      caller,
      requestId,
      decodePathSegment(exportMatch[1]),
    );
    sendJson(response, 200, exported);
    return true;
  }

  const projectMatch = requestPath.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (method === "GET" && projectMatch) {
    const caller = await options.identityResolver(request);
    const project = await options.projectService.getProject(
      caller,
      requestId,
      decodePathSegment(projectMatch[1]),
    );
    sendJson(response, 200, project);
    return true;
  }
  if (method === "PUT" && projectMatch) {
    const caller = await options.identityResolver(request);
    const project = await options.projectService.updateProject(
      caller,
      requestId,
      decodePathSegment(projectMatch[1]),
      parseJsonRequestBody(requestBody, request.headers["content-type"]),
    );
    sendJson(response, 200, project);
    return true;
  }
  if (method === "DELETE" && projectMatch) {
    requireEmptyRequestBody(
      requestBody,
      "project_delete_body_not_supported",
      "Project deletion does not accept a request body.",
    );
    if (requestUrl.search !== "") {
      throw new ApplicationError(
        400,
        "invalid_project_delete_request",
        "Invalid project deletion request",
        "Project deletion does not accept query parameters.",
      );
    }
    const caller = await options.identityResolver(request);
    await options.projectService.deleteProject(
      caller,
      requestId,
      decodePathSegment(projectMatch[1]),
    );
    response.statusCode = 204;
    response.end();
    return true;
  }
  return false;
}

async function handleProjectDocumentRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  requestId: string,
  method: string,
  requestPath: string,
  requestBody: string,
): Promise<boolean> {
  const componentsMatch = requestPath.match(
    /^\/api\/v1\/projects\/([^/]+)\/components$/,
  );
  if (componentsMatch && (method === "GET" || method === "PUT")) {
    const caller = await options.identityResolver(request);
    const projectId = decodePathSegment(componentsMatch[1]);
    const document =
      method === "GET"
        ? await options.projectComponentsService.getComponents(
            caller,
            requestId,
            projectId,
          )
        : await options.projectComponentsService.replaceComponents(
            caller,
            requestId,
            projectId,
            parseJsonRequestBody(requestBody, request.headers["content-type"]),
          );
    sendJson(response, 200, document);
    return true;
  }

  const workflowMatch = requestPath.match(
    /^\/api\/v1\/projects\/([^/]+)\/workflow$/,
  );
  if (workflowMatch && (method === "GET" || method === "PUT")) {
    const caller = await options.identityResolver(request);
    const projectId = decodePathSegment(workflowMatch[1]);
    const document =
      method === "GET"
        ? await options.projectWorkflowService.getWorkflow(
            caller,
            requestId,
            projectId,
          )
        : await options.projectWorkflowService.replaceWorkflow(
            caller,
            requestId,
            projectId,
            parseJsonRequestBody(requestBody, request.headers["content-type"]),
          );
    sendJson(response, 200, document);
    return true;
  }

  const modulesMatch = requestPath.match(
    /^\/api\/v1\/projects\/([^/]+)\/custom-modules$/,
  );
  if (modulesMatch && (method === "GET" || method === "PUT")) {
    const caller = await options.identityResolver(request);
    const projectId = decodePathSegment(modulesMatch[1]);
    const document =
      method === "GET"
        ? await options.projectCustomModulesService.getCustomModules(
            caller,
            requestId,
            projectId,
          )
        : await options.projectCustomModulesService.replaceCustomModules(
            caller,
            requestId,
            projectId,
            parseJsonRequestBody(requestBody, request.headers["content-type"]),
          );
    sendJson(response, 200, document);
    return true;
  }
  return handleAiBuilderHttpRoute(
    request,
    response,
    options,
    requestId,
    method,
    requestPath,
    requestBody,
  );
}

async function handleProjectPreviewRoute(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  requestId: string,
  method: string,
  requestPath: string,
  requestBody: string,
): Promise<boolean> {
  const route = requestPath.match(/^\/api\/v1\/projects\/([^/]+)\/preview$/);
  if (method !== "POST" || !route) return false;
  const caller = await options.identityResolver(request);
  if (requestBody.trim() !== "") {
    throw new ApplicationError(
      400,
      "preview_body_not_supported",
      "Preview request body not supported",
      "Preview requests do not accept a request body.",
    );
  }
  const preview = await options.projectPreviewService.generatePreview(
    caller,
    requestId,
    decodePathSegment(route[1]),
  );
  sendJson(response, 200, preview);
  return true;
}

async function handleCollaboratorRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  requestId: string,
  method: string,
  requestPath: string,
  requestBody: string,
): Promise<boolean> {
  const route = requestPath.match(
    /^\/api\/v1\/projects\/([^/]+)\/collaborators(?:\/([^/]+))?$/,
  );
  if (!route) return false;
  const caller = await options.identityResolver(request);
  const projectId = decodePathSegment(route[1]);
  const memberId = route[2];
  if (method === "GET" && memberId === undefined) {
    const collaborators = await options.projectService.listCollaborators(
      caller,
      requestId,
      projectId,
    );
    sendJson(response, 200, { items: collaborators });
    return true;
  }
  if (method === "PUT" && memberId === undefined) {
    await options.projectService.grantEditor(
      caller,
      requestId,
      projectId,
      parseJsonRequestBody(requestBody, request.headers["content-type"]),
    );
    response.statusCode = 204;
    response.end();
    return true;
  }
  if (method === "DELETE" && memberId !== undefined) {
    requireEmptyRequestBody(
      requestBody,
      "collaborator_body_not_supported",
      "Removing a collaborator does not accept a request body.",
    );
    await options.projectService.removeEditor(
      caller,
      requestId,
      projectId,
      decodeCollaboratorPathSegment(memberId),
    );
    response.statusCode = 204;
    response.end();
    return true;
  }
  return false;
}
