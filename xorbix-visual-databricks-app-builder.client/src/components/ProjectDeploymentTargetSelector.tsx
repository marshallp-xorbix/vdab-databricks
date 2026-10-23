import { Button } from "./ui/button";
import type { IWorkspaceAppSummary } from "../models/WorkspaceApp";
import type { ProjectChildAppMode } from "../models/ProjectDeployments";

interface IProjectDeploymentTargetSelectorProps {
  mode: ProjectChildAppMode;
  onModeChange: (mode: ProjectChildAppMode) => void;
  newAppName: string;
  onNewAppNameChange: (name: string) => void;
  selectedAppName: string;
  onSelectedAppNameChange: (name: string) => void;
  availableApps: readonly IWorkspaceAppSummary[];
  isAppsPending: boolean;
  isAppsError: boolean;
  appsErrorMessage: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
}

function ProjectDeploymentTargetSelector({
  mode,
  onModeChange,
  newAppName,
  onNewAppNameChange,
  selectedAppName,
  onSelectedAppNameChange,
  availableApps,
  isAppsPending,
  isAppsError,
  appsErrorMessage,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
}: Readonly<IProjectDeploymentTargetSelectorProps>) {
  return (
    <div className="grid gap-4 rounded-lg border border-border p-4">
      <fieldset className="space-y-2">
        <legend className="font-medium">Choose a child App target</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="deployment-mode"
            value="createNew"
            checked={mode === "createNew"}
            onChange={() => onModeChange("createNew")}
          />
          <span>Create a new App</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="deployment-mode"
            value="linkExisting"
            checked={mode === "linkExisting"}
            onChange={() => onModeChange("linkExisting")}
          />
          <span>Link an existing App</span>
        </label>
      </fieldset>
      {mode === "createNew" ? (
        <div className="grid gap-2">
          <label htmlFor="new-child-app-name" className="text-sm font-medium">
            New App name
          </label>
          <input
            id="new-child-app-name"
            autoComplete="off"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={newAppName}
            onChange={(event) => onNewAppNameChange(event.target.value)}
            aria-describedby="new-child-app-name-help"
          />
          <p
            id="new-child-app-name-help"
            className="text-sm text-muted-foreground"
          >
            Use 2–30 lowercase letters, numbers, or hyphens; the name must be
            unique in this workspace.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          <label htmlFor="existing-child-app" className="text-sm font-medium">
            Existing workspace App
          </label>
          <select
            id="existing-child-app"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedAppName}
            onChange={(event) => onSelectedAppNameChange(event.target.value)}
            disabled={isAppsPending || isAppsError}
          >
            <option value="">Select an App</option>
            {availableApps.map((app) => (
              <option key={app.name} value={app.name}>
                {app.name} · {app.appState ?? "unknown state"}
              </option>
            ))}
          </select>
          {isAppsPending && (
            <p role="status">Loading Apps visible to your Databricks user…</p>
          )}
          {isAppsError && <p role="alert">{appsErrorMessage}</p>}
          {hasNextPage && (
            <Button
              type="button"
              variant="outline"
              disabled={isFetchingNextPage}
              onClick={onFetchNextPage}
            >
              {isFetchingNextPage ? "Loading more Apps…" : "Load more Apps"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectDeploymentTargetSelector;
