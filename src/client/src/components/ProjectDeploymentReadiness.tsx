import type { IProjectDeploymentReadiness as IProjectDeploymentReadinessModel } from "../models/ProjectDeployments";

interface IProjectDeploymentReadinessProps {
  readiness: IProjectDeploymentReadinessModel | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
}

const SCOPE_GUIDANCE: ReadonlyArray<{ scope: string; detail: string }> = [
  {
    scope: "files",
    detail:
      "File Upload requires the child App user authorization scope files. New Apps created by Deploy receive required scopes automatically; linked Apps must already include files, and each user must consent.",
  },
  {
    scope: "genie",
    detail:
      "Genie Chat requires the child App user authorization scope genie and a bound Genie space resource under Settings → Resources.",
  },
  {
    scope: "model-serving",
    detail:
      "Model Chat requires the child App user authorization scope model-serving and a bound serving endpoint resource with CAN_QUERY or CAN_MANAGE.",
  },
];

/** Shows saved-project deployment requirements, blockers, and scope guidance. */
function ProjectDeploymentReadiness({
  readiness,
  isPending,
  isError,
  errorMessage,
}: Readonly<IProjectDeploymentReadinessProps>) {
  const appResources = readiness?.appResources ?? [];
  const scopeNotes = SCOPE_GUIDANCE.filter((entry) =>
    readiness?.userApiScopes.includes(entry.scope),
  );
  return (
    <>
      {isPending && <p role="status">Checking saved project requirements…</p>}
      {isError && <p role="alert">{errorMessage}</p>}
      {readiness && (
        <div className="space-y-2 rounded-lg bg-muted/40 p-4">
          <h3 className="font-medium">Required child App user scopes</h3>
          <p className="text-sm">
            {readiness.userApiScopes.length > 0
              ? readiness.userApiScopes.join(", ")
              : "No additional user scopes are required by this project."}
          </p>
          {scopeNotes.map((entry) => (
            <p className="text-sm text-muted-foreground" key={entry.scope}>
              {entry.detail}
            </p>
          ))}
          {appResources.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Required child App resources</h4>
              {appResources.map((resource, index) => (
                <p className="text-sm" key={`${resource.name}-${index}`}>
                  {resource.name}: {formatRequiredResourceDetail(resource)}
                </p>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            The builder App needs the approved apps and workspace.workspace user
            scopes and your consent. The Workspace Import API documents a
            workspace scope, so verify that the configured Apps scope authorizes
            source uploads in your workspace. App Spaces may also require CAN
            CREATE APP.
          </p>
          <p className="text-sm text-muted-foreground">
            The child App service principal must be able to read its generated
            source folder. Databricks Apps compute is billed while running and
            workspaces allow up to 100 Apps; workspace usage policies and
            remaining App capacity apply.
          </p>
          {readiness.blockers.map((blocker) => (
            <p key={`${blocker.code}-${blocker.detail}`} role="alert">
              {blocker.detail}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

function formatRequiredResourceDetail(
  resource: IProjectDeploymentReadinessModel["appResources"][number],
): string {
  if ("postgres" in resource) {
    return `${resource.postgres.database} — CAN_CONNECT_AND_CREATE`;
  }
  if ("database" in resource) {
    return `${resource.database.instance_name}/${resource.database.database_name} — CAN_CONNECT_AND_CREATE`;
  }
  if ("sql_warehouse" in resource) {
    return `SQL warehouse ${resource.sql_warehouse.id} — ${resource.sql_warehouse.permission}`;
  }
  if ("genie_space" in resource) {
    return `Genie space ${resource.genie_space.name || resource.genie_space.space_id} — ${resource.genie_space.permission}`;
  }
  if ("serving_endpoint" in resource) {
    return `Serving endpoint ${resource.serving_endpoint.name} — ${resource.serving_endpoint.permission}`;
  }
  if ("secret" in resource) {
    return `Secret ${resource.secret.scope}/${resource.secret.key} — ${resource.secret.permission}`;
  }
  if ("job" in resource) {
    return `Job ${resource.job.id} — ${resource.job.permission}`;
  }
  if ("experiment" in resource) {
    return `Experiment ${resource.experiment.experiment_id} — ${resource.experiment.permission}`;
  }
  if ("uc_securable" in resource) {
    return `${resource.uc_securable.securable_type} ${resource.uc_securable.securable_full_name} — ${resource.uc_securable.permission}`;
  }
  return "Required App resource";
}

export default ProjectDeploymentReadiness;
