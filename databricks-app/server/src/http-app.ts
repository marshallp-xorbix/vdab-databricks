import { createReadStream, type Stats } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { extname, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CallerIdentity,
  SessionResponse,
  WorkspaceAppsPage,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import type { IdentityResolver } from "./identity.ts";
import type { WorkspaceAppsService } from "./workspace-apps-service.ts";
import type { ProjectService } from "./db/project-service.ts";
import type { ProjectComponentsService } from "./db/project-components-service.ts";
import type { ProjectWorkflowService } from "./db/project-workflow-service.ts";
import type { ProjectCustomModulesService } from "./db/project-custom-modules-service.ts";
import type { ComponentRegistryService } from "./component-registry/component-registry-service.ts";
import type { ProjectPreviewService } from "./generation/project-preview-service.ts";
import type { ProjectPortabilityService } from "./db/project-portability-service.ts";
import type { WorkspaceResourcesService } from "./workspace-resources-service.ts";
import { matchWorkspaceResourcesRoute } from "./workspace-resources-routes.ts";
import type { WorkspaceExecutionResourcesService } from "./workspace-execution-resources-service.ts";
import { matchWorkspaceExecutionResourcesRoute } from "./workspace-execution-resources-routes.ts";
import type { WorkspaceLakebaseResourcesService } from "./workspace-lakebase-resources-service.ts";
import { matchWorkspaceLakebaseResourcesRoute } from "./workspace-lakebase-resources-routes.ts";
import type { AiBuilderEvent } from "./ai-builder-contract.ts";
import type { AiBuilderService } from "./ai-builder-service.ts";

const HEALTH_PATH = "/api/health/live";
const SESSION_PATH = "/api/v1/session";
const WORKSPACE_APPS_PATH = "/api/v1/workspace/apps";
const COMPONENT_DEFINITIONS_PATH = "/api/v1/component-definitions";
const DEFAULT_MAX_REQUEST_BYTES = 1_048_576;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE_TOKEN_LENGTH = 2048;

/** Structured request event that intentionally excludes headers and query values. */
export interface RequestLogRecord {
  event: "request.completed";
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

/** Dependencies for the small, same-origin Node HTTP boundary. */
export interface HttpAppOptions {
  identityResolver: IdentityResolver;
  workspaceAppsService: WorkspaceAppsService;
  workspaceResourcesService: WorkspaceResourcesService;
  workspaceExecutionResourcesService: WorkspaceExecutionResourcesService;
  workspaceLakebaseResourcesService: WorkspaceLakebaseResourcesService;
  projectService: ProjectService;
  projectComponentsService: ProjectComponentsService;
  projectWorkflowService: ProjectWorkflowService;
  projectCustomModulesService: ProjectCustomModulesService;
  projectPreviewService: ProjectPreviewService;
  projectPortabilityService: ProjectPortabilityService;
  aiBuilderService?: AiBuilderService;
  componentRegistryService: ComponentRegistryService;
  staticDirectory: string;
  workspaceId: string | null;
  workspaceHost: string | null;
  maxRequestBytes?: number;
  logRequest?: (record: RequestLogRecord) => void;
}

/** Creates the same-process API and static asset server used by Databricks Apps. */
export function createHttpApp(options: HttpAppOptions): Server {
  const staticDirectory = resolve(options.staticDirectory);
  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;

  return createServer((request, response) => {
    void handleRequest(request, response, options, staticDirectory, maxRequestBytes);
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  staticDirectory: string,
  maxRequestBytes: number,
): Promise<void> {
  const requestId = randomUUID();
  const startedAt = performance.now();
  const method = request.method ?? "GET";
  let requestPath = "/";
  let status = 500;

  response.setHeader("x-request-id", requestId);
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "same-origin");

  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    requestPath = requestUrl.pathname;
    const requestBody = await readRequestBodyWithinLimit(request, maxRequestBytes);

    if (method === "GET" && requestPath === HEALTH_PATH) {
      status = 200;
      sendJson(response, status, { status: "ok" });
      return;
    }

    if (method === "GET" && requestPath === SESSION_PATH) {
      const caller = await options.identityResolver(request);
      const session = toSessionResponse(caller, options);
      status = 200;
      sendJson(response, status, session);
      return;
    }

    if (method === "GET" && requestPath === WORKSPACE_APPS_PATH) {
      const caller = await options.identityResolver(request);
      const pageSize = readPageSize(requestUrl.searchParams.get("pageSize"));
      const pageToken = readPageToken(requestUrl.searchParams.get("pageToken"));
      const apps = await options.workspaceAppsService.listApps(caller, {
        pageSize,
        pageToken,
      });
      status = 200;
      sendJson(response, status, apps satisfies WorkspaceAppsPage);
      return;
    }

    const executionResourcesRoute = matchWorkspaceExecutionResourcesRoute(
      method,
      requestUrl,
    );

    if (executionResourcesRoute) {
      const caller = await options.identityResolver(request);
      const resources = executionResourcesRoute.type === "jobs"
        ? await options.workspaceExecutionResourcesService.listJobs(caller)
        : await options.workspaceExecutionResourcesService.listSqlWarehouses(caller);
      status = 200;
      sendJson(response, status, resources);
      return;
    }

    const lakebaseResourcesRoute = matchWorkspaceLakebaseResourcesRoute(method, requestUrl);
    if (lakebaseResourcesRoute) {
      const caller = await options.identityResolver(request);
      const resources = lakebaseResourcesRoute.type === "projects"
        ? await options.workspaceLakebaseResourcesService.listProjects(caller)
        : lakebaseResourcesRoute.type === "branches"
        ? await options.workspaceLakebaseResourcesService.listBranches(caller, lakebaseResourcesRoute.projectId)
        : lakebaseResourcesRoute.type === "endpoints"
        ? await options.workspaceLakebaseResourcesService.listEndpoints(
            caller,
            lakebaseResourcesRoute.projectId,
            lakebaseResourcesRoute.branchId,
          )
        : lakebaseResourcesRoute.type === "databases"
        ? await options.workspaceLakebaseResourcesService.listDatabases(
            caller,
            lakebaseResourcesRoute.projectId,
            lakebaseResourcesRoute.branchId,
          )
        : lakebaseResourcesRoute.type === "schemas"
        ? await options.workspaceLakebaseResourcesService.listSchemas(
            caller,
            lakebaseResourcesRoute.projectId,
            lakebaseResourcesRoute.branchId,
            lakebaseResourcesRoute.endpointId,
            lakebaseResourcesRoute.databaseName,
          )
        : await options.workspaceLakebaseResourcesService.listTables(
            caller,
            lakebaseResourcesRoute.projectId,
            lakebaseResourcesRoute.branchId,
            lakebaseResourcesRoute.endpointId,
            lakebaseResourcesRoute.databaseName,
            lakebaseResourcesRoute.schemaName,
          );
      status = 200;
      sendJson(response, status, resources);
      return;
    }

    const workspaceResourcesRoute = matchWorkspaceResourcesRoute(
      method,
      requestUrl,
    );

    if (workspaceResourcesRoute) {
      const caller = await options.identityResolver(request);
      const resources = workspaceResourcesRoute.type === "genieSpaces"
        ? await options.workspaceResourcesService.listGenieSpaces(caller)
        : workspaceResourcesRoute.type === "servingEndpoints"
        ? await options.workspaceResourcesService.listServingEndpoints(caller)
        : workspaceResourcesRoute.type === "catalogs"
        ? await options.workspaceResourcesService.listCatalogs(caller)
        : workspaceResourcesRoute.type === "schemas"
        ? await options.workspaceResourcesService.listSchemas(
            caller,
            workspaceResourcesRoute.catalogName,
          )
        : workspaceResourcesRoute.type === "volumes"
        ? await options.workspaceResourcesService.listVolumes(
            caller,
            workspaceResourcesRoute.catalogName,
            workspaceResourcesRoute.schemaName,
          )
        : await options.workspaceResourcesService.listTables(
            caller,
            workspaceResourcesRoute.catalogName,
            workspaceResourcesRoute.schemaName,
          );
      status = 200;
      sendJson(response, status, resources);
      return;
    }

    if (method === "GET" && requestPath === COMPONENT_DEFINITIONS_PATH) {
      await options.identityResolver(request);
      status = 200;
      sendJson(response, status, options.componentRegistryService.getRegistry());
      return;
    }

    const componentDefinitionRoute = requestPath.match(
      /^\/api\/v1\/component-definitions\/([^/]+)$/,
    );

    if (method === "GET" && componentDefinitionRoute) {
      await options.identityResolver(request);
      status = 200;
      sendJson(
        response,
        status,
        options.componentRegistryService.getDefinition(
          decodeComponentTypeSegment(componentDefinitionRoute[1]),
        ),
      );
      return;
    }

    if (method === "GET" && requestPath === "/api/v1/projects") {
      const caller = await options.identityResolver(request);
      const projects = await options.projectService.listProjects(caller, requestId);
      status = 200;
      sendJson(response, status, { items: projects });
      return;
    }

    if (method === "POST" && requestPath === "/api/v1/projects/import") {
      const caller = await options.identityResolver(request);
      const imported = await options.projectPortabilityService.importProject(
        caller,
        requestId,
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      );
      status = 201;
      sendJson(response, status, imported);
      return;
    }

    if (method === "POST" && requestPath === "/api/v1/projects") {
      const caller = await options.identityResolver(request);
      const project = await options.projectService.createProject(
        caller,
        requestId,
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      );
      status = 201;
      sendJson(response, status, project);
      return;
    }

    const projectExportRoute = requestPath.match(/^\/api\/v1\/projects\/([^/]+)\/export$/);

    if (method === "GET" && projectExportRoute) {
      const caller = await options.identityResolver(request);
      const exported = await options.projectPortabilityService.exportProject(
        caller,
        requestId,
        decodePathSegment(projectExportRoute[1]),
      );
      status = 200;
      sendJson(response, status, exported);
      return;
    }

    const projectRoute = requestPath.match(/^\/api\/v1\/projects\/([^/]+)$/);

    if (method === "GET" && projectRoute) {
      const caller = await options.identityResolver(request);
      const project = await options.projectService.getProject(
        caller,
        requestId,
        decodePathSegment(projectRoute[1]),
      );
      status = 200;
      sendJson(response, status, project);
      return;
    }

    if (method === "PUT" && projectRoute) {
      const caller = await options.identityResolver(request);
      const project = await options.projectService.updateProject(
        caller,
        requestId,
        decodePathSegment(projectRoute[1]),
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      );
      status = 200;
      sendJson(response, status, project);
      return;
    }

    const projectComponentsRoute = requestPath.match(
      /^\/api\/v1\/projects\/([^/]+)\/components$/,
    );

    if (method === "GET" && projectComponentsRoute) {
      const caller = await options.identityResolver(request);
      const components = await options.projectComponentsService.getComponents(
        caller,
        requestId,
        decodePathSegment(projectComponentsRoute[1]),
      );
      status = 200;
      sendJson(response, status, components);
      return;
    }

    if (method === "PUT" && projectComponentsRoute) {
      const caller = await options.identityResolver(request);
      const components = await options.projectComponentsService.replaceComponents(
        caller,
        requestId,
        decodePathSegment(projectComponentsRoute[1]),
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      );
      status = 200;
      sendJson(response, status, components);
      return;
    }

    const projectWorkflowRoute = requestPath.match(
      /^\/api\/v1\/projects\/([^/]+)\/workflow$/,
    );

    if (method === "GET" && projectWorkflowRoute) {
      const caller = await options.identityResolver(request);
      const workflow = await options.projectWorkflowService.getWorkflow(
        caller,
        requestId,
        decodePathSegment(projectWorkflowRoute[1]),
      );
      status = 200;
      sendJson(response, status, workflow);
      return;
    }

    if (method === "PUT" && projectWorkflowRoute) {
      const caller = await options.identityResolver(request);
      const workflow = await options.projectWorkflowService.replaceWorkflow(
        caller,
        requestId,
        decodePathSegment(projectWorkflowRoute[1]),
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      );
      status = 200;
      sendJson(response, status, workflow);
      return;
    }

    const projectCustomModulesRoute = requestPath.match(
      /^\/api\/v1\/projects\/([^/]+)\/custom-modules$/,
    );

    if (method === "GET" && projectCustomModulesRoute) {
      const caller = await options.identityResolver(request);
      const document = await options.projectCustomModulesService.getCustomModules(
        caller,
        requestId,
        decodePathSegment(projectCustomModulesRoute[1]),
      );
      status = 200;
      sendJson(response, status, document);
      return;
    }

    if (method === "PUT" && projectCustomModulesRoute) {
      const caller = await options.identityResolver(request);
      const document = await options.projectCustomModulesService.replaceCustomModules(
        caller,
        requestId,
        decodePathSegment(projectCustomModulesRoute[1]),
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      );
      status = 200;
      sendJson(response, status, document);
      return;
    }

    const projectAiBuilderRoute = requestPath.match(
      /^\/api\/v1\/projects\/([^/]+)\/ai-builder$/,
    );

    if (method === "POST" && projectAiBuilderRoute) {
      if (!options.aiBuilderService) {
        throw new ApplicationError(503, "ai_builder_unavailable", "AI Builder unavailable", "The AI Builder service is not configured.");
      }
      const caller = await options.identityResolver(request);
      const prepared = await options.aiBuilderService.prepare(
        caller,
        requestId,
        decodePathSegment(projectAiBuilderRoute[1]),
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      );
      status = 200;
      await streamAiBuilderResponse(request, response, prepared);
      return;
    }

    const projectPreviewRoute = requestPath.match(
      /^\/api\/v1\/projects\/([^/]+)\/preview$/,
    );

    if (method === "POST" && projectPreviewRoute) {
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
        decodePathSegment(projectPreviewRoute[1]),
      );
      status = 200;
      sendJson(response, status, preview);
      return;
    }

    const collaboratorRoute = requestPath.match(
      /^\/api\/v1\/projects\/([^/]+)\/collaborators$/,
    );

    if (method === "GET" && collaboratorRoute) {
      const caller = await options.identityResolver(request);
      const collaborators = await options.projectService.listCollaborators(
        caller,
        requestId,
        decodePathSegment(collaboratorRoute[1]),
      );
      status = 200;
      sendJson(response, status, { items: collaborators });
      return;
    }

    if (method === "PUT" && collaboratorRoute) {
      const caller = await options.identityResolver(request);
      await options.projectService.grantEditor(
        caller,
        requestId,
        decodePathSegment(collaboratorRoute[1]),
        parseJsonRequestBody(requestBody, request.headers["content-type"]),
      );
      status = 204;
      response.statusCode = status;
      response.end();
      return;
    }

    const collaboratorMemberRoute = requestPath.match(
      /^\/api\/v1\/projects\/([^/]+)\/collaborators\/([^/]+)$/,
    );

    if (method === "DELETE" && collaboratorMemberRoute) {
      if (requestBody.trim() !== "") {
        throw new ApplicationError(
          400,
          "collaborator_body_not_supported",
          "Collaborator request body not supported",
          "Removing a collaborator does not accept a request body.",
        );
      }

      const caller = await options.identityResolver(request);
      await options.projectService.removeEditor(
        caller,
        requestId,
        decodePathSegment(collaboratorMemberRoute[1]),
        decodeCollaboratorPathSegment(collaboratorMemberRoute[2]),
      );
      status = 204;
      response.statusCode = status;
      response.end();
      return;
    }

    if (requestPath.startsWith("/api/")) {
      throw new ApplicationError(
        404,
        "route_not_found",
        "API route not found",
        "The requested API route does not exist.",
      );
    }

    if (method === "GET" || method === "HEAD") {
      const foundStatus = await serveStaticAsset(
        requestPath,
        response,
        staticDirectory,
        method === "HEAD",
      );
      status = foundStatus;
      return;
    }

    throw new ApplicationError(
      404,
      "route_not_found",
      "Route not found",
      "The requested route does not exist.",
    );
  } catch (error) {
    const applicationError = toApplicationError(error);
    if (response.headersSent) {
      if (!response.destroyed && !response.writableEnded) {
        writeSseError(response, applicationError);
        response.end();
      }
    } else {
      status = applicationError.status;
      sendProblem(response, applicationError, requestId);
    }
  } finally {
    options.logRequest?.({
      event: "request.completed",
      requestId,
      method,
      path: requestPath,
      status,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    });
  }
}

async function streamAiBuilderResponse(
  request: IncomingMessage,
  response: ServerResponse,
  prepared: Awaited<ReturnType<AiBuilderService["prepare"]>>,
): Promise<void> {
  const cancellation = new AbortController();
  const abortWhenDisconnected = (): void => cancellation.abort();
  const abortOnResponseClose = (): void => {
    if (!response.writableEnded) cancellation.abort();
  };
  request.once("aborted", abortWhenDisconnected);
  response.once("close", abortOnResponseClose);

  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream; charset=utf-8");
  response.setHeader("cache-control", "no-cache, no-transform");
  response.setHeader("connection", "keep-alive");
  response.setHeader("x-accel-buffering", "no");

  try {
    await prepared.execute(cancellation.signal, async (event) =>
      writeAiBuilderEvent(response, event, cancellation.signal),
    );
    if (!response.destroyed && !response.writableEnded) response.end();
  } finally {
    request.off("aborted", abortWhenDisconnected);
    response.off("close", abortOnResponseClose);
  }
}

async function writeAiBuilderEvent(
  response: ServerResponse,
  event: AiBuilderEvent,
  signal: AbortSignal,
): Promise<void> {
  if (response.destroyed || response.writableEnded || signal.aborted) return;
  const frame = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
  if (!response.write(frame)) await once(response, "drain", { signal });
}

function writeSseError(response: ServerResponse, error: ApplicationError): void {
  const data = JSON.stringify({
    title: error.title,
    status: error.status,
    detail: error.message,
  });
  response.write(`event: error\ndata: ${data}\n\n`);
}

async function readRequestBodyWithinLimit(
  request: IncomingMessage,
  maxRequestBytes: number,
): Promise<string> {
  let requestBytes = 0;
  const bodyChunks: Buffer[] = [];

  for await (const requestChunk of request) {
    const chunkBytes =
      typeof requestChunk === "string"
        ? Buffer.byteLength(requestChunk)
        : requestChunk.byteLength;
    requestBytes += chunkBytes;

    if (requestBytes > maxRequestBytes) {
      throw new ApplicationError(
        413,
        "request_too_large",
        "Request body too large",
        `Request bodies cannot exceed ${maxRequestBytes} bytes.`,
      );
    }

    bodyChunks.push(Buffer.from(requestChunk));
  }

  return Buffer.concat(bodyChunks).toString("utf8");
}

function parseJsonRequestBody(
  requestBody: string,
  contentType: string | string[] | undefined,
): unknown {
  const normalizedContentType = Array.isArray(contentType)
    ? contentType[0]
    : contentType;

  if (
    !normalizedContentType ||
    !/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(normalizedContentType)
  ) {
    throw new ApplicationError(
      415,
      "json_content_type_required",
      "JSON content type required",
      "Send this request with an application/json content type.",
    );
  }

  try {
    const parsedBody: unknown = JSON.parse(requestBody);
    return parsedBody;
  } catch {
    throw new ApplicationError(
      400,
      "invalid_json",
      "Invalid JSON",
      "The request body must contain valid JSON.",
    );
  }
}

function decodePathSegment(value: string | undefined): string {
  if (!value) {
    throw new ApplicationError(
      400,
      "invalid_project_id",
      "Invalid project ID",
      "The project ID is invalid.",
    );
  }

  try {
    const decodedValue = decodeURIComponent(value);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedValue)) {
      throw new Error("Invalid ID format");
    }

    return decodedValue;
  } catch {
    throw new ApplicationError(
      400,
      "invalid_project_id",
      "Invalid project ID",
      "The project ID is invalid.",
    );
  }
}

function decodeCollaboratorPathSegment(value: string | undefined): string {
  if (!value) {
    throw new ApplicationError(
      400,
      "invalid_collaborator",
      "Invalid collaborator",
      "The collaborator ID is invalid.",
    );
  }

  try {
    return decodeURIComponent(value);
  } catch {
    throw new ApplicationError(
      400,
      "invalid_collaborator",
      "Invalid collaborator",
      "The collaborator ID is invalid.",
    );
  }
}

function decodeComponentTypeSegment(value: string | undefined): string {
  if (!value) {
    throw invalidComponentType();
  }

  try {
    const decodedValue = decodeURIComponent(value);

    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(decodedValue)) {
      throw invalidComponentType();
    }

    return decodedValue;
  } catch {
    throw invalidComponentType();
  }
}

function invalidComponentType(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_component_type",
    "Invalid component type",
    "The component type is invalid.",
  );
}

function readPageSize(rawPageSize: string | null): number {
  if (rawPageSize === null) {
    return DEFAULT_PAGE_SIZE;
  }

  const pageSize = Number(rawPageSize);

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ApplicationError(
      400,
      "invalid_page_size",
      "Invalid page size",
      `Page size must be between 1 and ${MAX_PAGE_SIZE}.`,
    );
  }

  return pageSize;
}

function readPageToken(rawPageToken: string | null): string | null {
  if (rawPageToken && rawPageToken.length > MAX_PAGE_TOKEN_LENGTH) {
    throw new ApplicationError(
      400,
      "invalid_page_token",
      "Invalid page token",
      "The page token is too long.",
    );
  }

  return rawPageToken;
}

function toSessionResponse(
  caller: CallerIdentity,
  options: HttpAppOptions,
): SessionResponse {
  return {
    userId: caller.userId,
    preferredUsername: caller.preferredUsername,
    email: caller.email,
    workspace: {
      id: options.workspaceId,
      host: options.workspaceHost,
    },
    authenticationMode: caller.authenticationMode,
    installationAdmin: caller.isInstallationAdmin,
  };
}

async function serveStaticAsset(
  requestPath: string,
  response: ServerResponse,
  staticDirectory: string,
  headOnly: boolean,
): Promise<number> {
  const assetPath = await resolveStaticAssetPath(requestPath, staticDirectory);

  if (!assetPath) {
    response.statusCode = 404;
    response.end();
    return 404;
  }

  const assetStats = await readFileStats(assetPath);
  response.statusCode = 200;
  response.setHeader("content-type", contentTypeFor(assetPath));
  response.setHeader(
    "cache-control",
    requestPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
  );
  response.setHeader("content-length", assetStats.size);

  if (headOnly) {
    response.end();
    return 200;
  }

  await new Promise<void>((resolveStream, rejectStream) => {
    const assetStream = createReadStream(assetPath);
    assetStream.on("error", rejectStream);
    response.on("error", rejectStream);
    response.on("finish", resolveStream);
    assetStream.pipe(response);
  });

  return 200;
}

async function resolveStaticAssetPath(
  requestPath: string,
  staticDirectory: string,
): Promise<string | null> {
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const normalizedPath = decodedPath.replace(/^\/+/, "");
  const candidatePath = resolve(staticDirectory, normalizedPath || "index.html");
  const pathFromRoot = relative(staticDirectory, candidatePath);

  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
    return null;
  }

  const candidateStats = await readFileStatsOrNull(candidatePath);

  if (candidateStats?.isFile()) {
    return candidatePath;
  }

  if (extname(decodedPath).length > 0) {
    return null;
  }

  const indexPath = resolve(staticDirectory, "index.html");
  const indexStats = await readFileStatsOrNull(indexPath);

  return indexStats?.isFile() ? indexPath : null;
}

async function readFileStats(filePath: string): Promise<Stats> {
  return stat(filePath);
}

async function readFileStatsOrNull(filePath: string): Promise<Stats | null> {
  try {
    return await readFileStats(filePath);
  } catch {
    return null;
  }
}

function contentTypeFor(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".ts":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function sendProblem(
  response: ServerResponse,
  error: ApplicationError,
  requestId: string,
): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }

  response.statusCode = error.status;
  response.setHeader("content-type", "application/problem+json; charset=utf-8");
  response.end(
    JSON.stringify({
      type: "about:blank",
      title: error.title,
      status: error.status,
      detail: error.message,
      code: error.code,
      requestId,
    }),
  );
}

function toApplicationError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error;
  }

  return new ApplicationError(
    500,
    "internal_error",
    "Request failed",
    "The request could not be completed. Try again shortly.",
  );
}
