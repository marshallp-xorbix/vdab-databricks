import type {
  IProjectChildAppLink,
  IWorkspaceAppDeploymentTarget,
  ProjectChildAppMode,
} from "../models/ProjectDeployments";

interface IProjectDeploymentTargetStatusProps {
  childApp: IProjectChildAppLink | null;
  appName: string;
  mode: ProjectChildAppMode;
  target: IWorkspaceAppDeploymentTarget | null;
  isTargetPending: boolean;
  isTargetError: boolean;
  targetErrorMessage: string;
  missingScopes: readonly string[];
}

function ProjectDeploymentTargetStatus({
  childApp,
  appName,
  mode,
  target,
  isTargetPending,
  isTargetError,
  targetErrorMessage,
  missingScopes,
}: Readonly<IProjectDeploymentTargetStatusProps>) {
  return (
    <>
      {childApp && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="font-medium">Linked App: {childApp.appName}</p>
          <p className="text-sm text-muted-foreground">
            Workspace App ID: {childApp.appId ?? "Pending creation"}
          </p>
          {target?.appUrl && (
            <p className="flex flex-wrap gap-4 text-sm">
              <a
                className="underline underline-offset-4"
                href={target.appUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open child App
              </a>
              <a
                className="underline underline-offset-4"
                href={new URL("/logz", target.appUrl).href}
                target="_blank"
                rel="noreferrer"
              >
                View runtime logs
              </a>
            </p>
          )}
          {target && (
            <p className="text-sm text-muted-foreground">
              Current state: {target.appState ?? "unknown"} · compute{" "}
              {target.computeState ?? "unknown"}
            </p>
          )}
        </div>
      )}

      {appName && isTargetPending && (
        <p role="status">
          Checking the selected App's deployment and authorization details…
        </p>
      )}
      {appName && isTargetError && <p role="alert">{targetErrorMessage}</p>}
      {target && (
        <div
          className="space-y-2 rounded-lg border border-border p-4"
          aria-label={`Current details for ${target.name}`}
        >
          <h3 className="font-medium">Current target: {target.name}</h3>
          <p className="text-sm">
            App state: {target.appState ?? "unknown"} · compute:{" "}
            {target.computeState ?? "unknown"}
          </p>
          <p className="text-sm">
            Active deployment: {target.activeDeploymentId ?? "none reported"}
          </p>
          <p className="text-sm">
            App Space: {target.spaceName ?? "none (default workspace scope)"}
          </p>
          <p className="break-all text-sm text-muted-foreground">
            Current source: {target.sourceCodePath ?? "not reported"}
          </p>
          <p className="text-sm">
            User authorization scopes:{" "}
            {target.userApiScopes.length
              ? target.userApiScopes.join(", ")
              : "none reported"}
          </p>
          {target.effectiveUserApiScopes !== null && (
            <p className="text-sm">
              Effective authorization scopes: {" "}
              {target.effectiveUserApiScopes.length
                ? target.effectiveUserApiScopes.join(", ")
                : "none granted"}
            </p>
          )}
          {target.usesGitSource && (
            <p role="alert">
              This App uses Git source. VDAB will not replace it because
              switching to workspace source can remove its Git credentials.
            </p>
          )}
          {missingScopes.length > 0 && (
            <p role="alert">
              Add the required user scopes to this App before deploying:{" "}
              {missingScopes.join(", ")}.
            </p>
          )}
          {mode === "createNew" && !childApp && (
            <p role="alert">
              An App with this name already exists. Choose another name or
              switch to Link an existing App.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default ProjectDeploymentTargetStatus;
