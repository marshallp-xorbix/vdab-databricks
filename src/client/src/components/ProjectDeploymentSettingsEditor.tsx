import type { IProjectDeploymentSettings } from "../models/ProjectDeploymentSettings";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface IProjectDeploymentSettingsEditorProps {
  settings: IProjectDeploymentSettings | null;
  childAppName?: string;
  isDisabled: boolean;
  onChange: (settings: IProjectDeploymentSettings) => void;
}

/** Edits durable deployment choices without changing the installed workspace. */
function ProjectDeploymentSettingsEditor({
  settings,
  childAppName,
  isDisabled,
  onChange,
}: Readonly<IProjectDeploymentSettingsEditorProps>) {
  const current = settings ?? {
    mode: "createNew",
    appName: childAppName ?? "",
    workspacePath: null,
  };
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
          <option value="createNew">Create new Databricks App</option>
          <option value="linkExisting">Link existing Databricks App</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-target-app-name">Databricks App name</Label>
        <Input
          id="project-target-app-name"
          value={childAppName ?? current.appName}
          disabled={Boolean(childAppName)}
          maxLength={30}
          placeholder="unique-app-name"
          onChange={(event) =>
            onChange({ ...current, appName: event.target.value })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-workspace-path">Workspace path</Label>
        <Input
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
