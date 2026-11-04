import type { IProjectDeploymentReadiness as IProjectDeploymentReadinessModel } from "../models/ProjectDeployments";

interface IProjectDeploymentReadinessProps {
  readiness: IProjectDeploymentReadinessModel | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
}

function ProjectDeploymentReadiness({
  readiness,
  isPending,
  isError,
  errorMessage,
}: Readonly<IProjectDeploymentReadinessProps>) {
  const appResources = readiness?.appResources ?? [];
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
          {appResources.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Required child App resources</h4>
              {appResources.map((resource, index) => (
                <p className="text-sm" key={`${resource.name}-${index}`}>
                  {resource.name}: {"postgres" in resource
                    ? `${resource.postgres.database} — CAN_CONNECT_AND_CREATE`
                    : "database" in resource
                      ? `${resource.database.instance_name}/${resource.database.database_name} — CAN_CONNECT_AND_CREATE`
                      : `SQL warehouse ${resource.sql_warehouse.id} — ${resource.sql_warehouse.permission}`}
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
            <p key={blocker.code} role="alert">
              {blocker.detail}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

export default ProjectDeploymentReadiness;
