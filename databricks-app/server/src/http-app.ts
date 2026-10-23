import { createReadStream, type Stats } from "node:fs";
import { stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { CallerIdentity, SessionResponse } from "./contracts.ts";
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
import type { WorkspaceExecutionResourcesService } from "./workspace-execution-resources-service.ts";
import type { WorkspaceLakebaseResourcesService } from "./workspace-lakebase-resources-service.ts";
import type { WorkspaceLakebaseProvisionedResourcesService } from "./workspace-lakebase-provisioned-resources-service.ts";
import type { AiBuilderService } from "./ai-builder-service.ts";
import type { ProjectDeploymentService } from "./project-deployment-service.ts";
import type { WorkspaceSetupDiagnosticsProvider } from "./workspace-setup-diagnostics-service.ts";
import { handleProjectHttpRoute } from "./project-http-routes.ts";
import { sendJson, writeSseError } from "./http-responses.ts";
import { handleWorkspaceHttpRoute } from "./workspace-http-routes.ts";

const HEALTH_PATH = "/api/health/live";
const SESSION_PATH = "/api/v1/session";
const DEFAULT_MAX_REQUEST_BYTES = 1_048_576;

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
  workspaceLakebaseProvisionedResourcesService: WorkspaceLakebaseProvisionedResourcesService;
  workspaceSetupDiagnosticsService: WorkspaceSetupDiagnosticsProvider;
  projectService: ProjectService;
  projectComponentsService: ProjectComponentsService;
  projectWorkflowService: ProjectWorkflowService;
  projectCustomModulesService: ProjectCustomModulesService;
  projectPreviewService: ProjectPreviewService;
  projectDeploymentService?: ProjectDeploymentService;
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
    void handleRequest(
      request,
      response,
      options,
      staticDirectory,
      maxRequestBytes,
    );
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
    const requestBody = await readRequestBodyWithinLimit(
      request,
      maxRequestBytes,
    );

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

    const workspaceRouteStatus = await handleWorkspaceHttpRoute(
      request,
      response,
      options,
      method,
      requestUrl,
      requestPath,
    );
    if (workspaceRouteStatus !== null) {
      status = workspaceRouteStatus;
      return;
    }
    const projectRouteStatus = await handleProjectHttpRoute(
      request,
      response,
      options,
      requestId,
      method,
      requestUrl,
      requestPath,
      requestBody,
    );
    if (projectRouteStatus !== null) {
      status = projectRouteStatus;
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
    requestPath.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
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
  const candidatePath = resolve(
    staticDirectory,
    normalizedPath || "index.html",
  );
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
