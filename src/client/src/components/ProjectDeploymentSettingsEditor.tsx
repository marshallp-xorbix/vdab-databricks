import { useEffect, useMemo, useRef } from "react";
import type { IProjectDeploymentSettings } from "../models/ProjectDeploymentSettings";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useWorkspaceApps } from "../hooks/useWorkspaceApps";

interface IProjectDeploymentSettingsEditorProps {
  settings: IProjectDeploymentSettings | null;
  childAppName?: string;
  isDisabled: boolean;
  focusTarget?: boolean;
  onChange: (settings: IProjectDeploymentSettings) => void;
}

/** Edits durable deployment choices without changing the installed workspace. */
function ProjectDeploymentSettingsEditor({
  settings,
  childAppName,
  isDisabled,
  focusTarget = false,
  onChange,
}: Readonly<IProjectDeploymentSettingsEditorProps>) {
  const workspacePathRef = useRef<HTMLInputElement>(null);
  const appsQuery = useWorkspaceApps(!childAppName);
  const appNames = useMemo(
    () =>
      [...new Set((appsQuery.data?.items ?? []).map((app) => app.name))]
        .filter((name) => name.trim().length > 0)
        .sort((left, right) => left.localeCompare(right)),
    [appsQuery.data?.items],
  );
  useEffect(() => {
    if (focusTarget) workspacePathRef.current?.focus();
  }, [focusTarget]);
  const current = settings ?? {
    mode: "createNew",
    appName: childAppName ?? "",
    workspacePath: null,
  };
  const appNameValue = childAppName ?? current.appName;
  const appNameIsKnown =
    !appNameValue ||
    appNames.includes(appNameValue) ||
    Boolean(childAppName) ||
    current.mode === "createNew";

  return (
    <fieldset
      disabled={isDisabled}
      className="grid gap-4 rounded-xl border border-border bg-card p-6"
    >
      <legend className="px-1 text-sm font-semibold">
        Workspace &amp; Infrastructure
      </legend>
      <div className="grid gap-2">
        <Label htmlFor="project-target-mode">Databricks App</Label>
        <select
          id="project-target-mode"
          value={current.mode}
          disabled={Boolean(childAppName)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          onChange={(event) =>
            onChange({
              ...current,
              mode:
                event.target.value === "linkExisting"
                  ? "linkExisting"
                  : "createNew",
            })
          }
        >
          <option value="createNew">
            {childAppName ? "Linked App created by VDAB" : "Create new Databricks App"}
          </option>
          <option value="linkExisting">
            {childAppName ? "Linked existing Databricks App" : "Link existing Databricks App"}
          </option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-target-app-name">Databricks App name</Label>
        {current.mode === "linkExisting" && !childAppName ? (
          <select
            id="project-target-app-name"
            value={appNameValue}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) =>
              onChange({ ...current, appName: event.target.value })
            }
          >
            <option value="">Select a Databricks App</option>
            {appNameValue && !appNames.includes(appNameValue) ? (
              <option value={appNameValue}>{appNameValue} (not in list)</option>
            ) : null}
            {appNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="project-target-app-name"
            value={appNameValue}
            disabled={Boolean(childAppName)}
            maxLength={30}
            placeholder="unique-app-name"
            list="project-target-app-name-options"
            onChange={(event) =>
              onChange({ ...current, appName: event.target.value })
            }
          />
        )}
        <datalist id="project-target-app-name-options">
          {appNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {appsQuery.isPending ? (
          <p role="status" className="text-xs text-muted-foreground">
            Loading Databricks Apps in this workspace…
          </p>
        ) : null}
        {appsQuery.isError ? (
          <p role="alert" className="text-xs text-destructive">
            {appsQuery.error.message}
          </p>
        ) : null}
        {!appNameIsKnown ? (
          <p role="status" className="text-xs text-warning-foreground">
            Choose an App name from the current workspace list before saving.
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-workspace-path">Workspace path</Label>
        <Input
          ref={workspacePathRef}
          id="project-workspace-path"
          value={current.workspacePath ?? ""}
          maxLength={1024}
          placeholder="/Workspace/Users/username/my-apps"
          aria-describedby="project-workspace-path-description"
          onChange={(event) =>
            onChange({ ...current, workspacePath: event.target.value || null })
          }
        />
        <p
          id="project-workspace-path-description"
          className="text-xs text-muted-foreground"
        >
          The workspace folder for this app's generated deployment snapshots.
          Leave blank to use your default VDAB folder.
        </p>
      </div>
    </fieldset>
  );
}

export default ProjectDeploymentSettingsEditor;
