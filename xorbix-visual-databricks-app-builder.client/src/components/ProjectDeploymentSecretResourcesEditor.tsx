import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type {
  IWorkspaceAppDeploymentTarget,
  IWorkspaceSecretResourceSelection,
} from "../models/ProjectDeployments";
import { getProjectDeploymentSecretEnvironmentVariable } from "../utils/projectDeploymentSecretEnvironmentVariable";

const MAX_SECRET_IDENTIFIER_LENGTH = 128;
const MAX_APP_RESOURCE_NAME_LENGTH = 30;

interface IProjectDeploymentSecretResourcesEditorProps {
  allowCreate: boolean;
  target: IWorkspaceAppDeploymentTarget | null;
  selections: IWorkspaceSecretResourceSelection[];
  onChange: (selections: IWorkspaceSecretResourceSelection[]) => void;
}

/** Lets users bind secret identifiers without reading or handling secret values. */
function ProjectDeploymentSecretResourcesEditor({
  allowCreate,
  target,
  selections,
  onChange,
}: Readonly<IProjectDeploymentSecretResourcesEditorProps>) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [key, setKey] = useState("");
  const secretResources = target?.secretResources ?? [];
  const normalizedName = name.trim();
  const normalizedScope = scope.trim();
  const normalizedKey = key.trim();
  const canAdd =
    isSecretResourceName(normalizedName) &&
    isSecretIdentifier(normalizedScope) &&
    isSecretIdentifier(normalizedKey) &&
    !selections.some((selection) => selection.name === normalizedName);

  function addSecretResource() {
    if (!canAdd) return;
    onChange([
      ...selections,
      { name: normalizedName, scope: normalizedScope, key: normalizedKey },
    ]);
    setName("");
    setKey("");
  }

  function toggleExistingSecret(
    resource: IWorkspaceAppDeploymentTarget["secretResources"][number],
    checked: boolean,
  ) {
    const remaining = selections.filter(
      (selection) => selection.name !== resource.name,
    );
    onChange(
      checked
        ? [
            ...remaining,
            {
              name: resource.name,
              scope: resource.secret.scope,
              key: resource.secret.key,
            },
          ]
        : remaining,
    );
  }

  function removeNewSecret(index: number) {
    onChange(selections.filter((_, selectionIndex) => selectionIndex !== index));
  }

  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">Secret resources</legend>
      <p className="text-sm text-muted-foreground">
        Databricks injects selected values at runtime. VDAB stores only scope and
        key names. Read permission applies to every secret in the selected scope.
      </p>
      {allowCreate ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="space-y-1 text-sm">
            <span>App resource key</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_APP_RESOURCE_NAME_LENGTH}
              autoComplete="off"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Secret scope</span>
            <Input
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              maxLength={MAX_SECRET_IDENTIFIER_LENGTH}
              autoComplete="off"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Secret key</span>
            <Input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              maxLength={MAX_SECRET_IDENTIFIER_LENGTH}
              autoComplete="off"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!canAdd}
            onClick={addSecretResource}
          >
            Add secret
          </Button>
        </div>
      ) : !target ? (
        <p role="status" className="text-sm text-muted-foreground">
          Select an existing App to review its secret resources.
        </p>
      ) : secretResources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The selected App has no supported secret resources.
        </p>
      ) : (
        <div className="space-y-2">
          {secretResources.map((resource) => {
            const checked = selections.some(
              (selection) => selection.name === resource.name,
            );
            const canRead = resource.secret.permission === "READ";
            return (
              <label key={resource.name} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canRead}
                  onChange={(event) =>
                    toggleExistingSecret(resource, event.target.checked)
                  }
                />
                <span>
                  <span className="block font-medium">{resource.name}</span>
                  <span className="block text-muted-foreground">
                    {resource.secret.scope} / {resource.secret.key} · {resource.secret.permission}
                    {!canRead && " · remove or change this grant in the workspace before linking"}
                  </span>
                  <code className="block text-xs">
                    {getProjectDeploymentSecretEnvironmentVariable(resource.name)}
                  </code>
                </span>
              </label>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Select every read-only secret resource attached to this App to match its current resource grants.
          </p>
        </div>
      )}
      {allowCreate && selections.length > 0 && (
        <ul aria-label="Selected new secret resources" className="space-y-1 text-sm">
          {selections.map((selection, index) => (
            <li key={selection.name} className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">{selection.name}</span>
                <span className="block text-muted-foreground">
                  {selection.scope} / {selection.key}
                </span>
                <code className="text-xs">
                  {getProjectDeploymentSecretEnvironmentVariable(selection.name)}
                </code>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeNewSecret(index)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function isSecretIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_SECRET_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isSecretResourceName(value: string): boolean {
  return (
    value.length <= MAX_APP_RESOURCE_NAME_LENGTH &&
    /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(value)
  );
}

export default ProjectDeploymentSecretResourcesEditor;
