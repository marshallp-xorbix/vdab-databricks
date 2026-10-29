/** One caller-authorized project child-App lifecycle route. */
export type ProjectDeploymentRoute =
  | { type: "history"; projectId: string }
  | { type: "readiness"; projectId: string }
  | { type: "resources"; projectId: string }
  | { type: "start"; projectId: string }
  | { type: "deployment"; projectId: string; deploymentId: string }
  | { type: "retry"; projectId: string; deploymentId: string }
  | { type: "rollback"; projectId: string; deploymentId: string };

const PROJECT_DEPLOYMENTS_PATH = /^\/api\/v1\/projects\/([^/]+)\/deployments(?:\/([^/]+)(?:\/(retry|rollback))?)?$/;

/** Matches deployment history and mutation endpoints without accepting workspace authority. */
export function matchProjectDeploymentRoute(
  method: string,
  pathname: string,
): ProjectDeploymentRoute | null {
  const readinessMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/deployments\/readiness$/);
  if (method === "GET" && readinessMatch) {
    return { type: "readiness", projectId: readinessMatch[1] ?? "" };
  }
  const resourceMatch = pathname.match(
    /^\/api\/v1\/projects\/([^/]+)\/deployments\/resources$/,
  );
  if (method === "PATCH" && resourceMatch) {
    return { type: "resources", projectId: resourceMatch[1] ?? "" };
  }
  const match = pathname.match(PROJECT_DEPLOYMENTS_PATH);
  if (!match) return null;
  const projectId = match[1] ?? "";
  const deploymentId = match[2] ?? null;
  const operation = match[3] ?? null;

  if (!deploymentId && !operation && method === "GET") {
    return { type: "history", projectId };
  }
  if (!deploymentId && !operation && method === "POST") {
    return { type: "start", projectId };
  }
  if (deploymentId && !operation && method === "GET") {
    return { type: "deployment", projectId, deploymentId };
  }
  if (deploymentId && operation === "retry" && method === "POST") {
    return { type: "retry", projectId, deploymentId };
  }
  if (deploymentId && operation === "rollback" && method === "POST") {
    return { type: "rollback", projectId, deploymentId };
  }
  return null;
}
