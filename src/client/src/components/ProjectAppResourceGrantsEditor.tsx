import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import type {
  IWorkspaceAppDeploymentTarget,
  IWorkspaceAppResource,
} from "../models/ProjectDeployments";
import { useUpdateProjectResourceGrants } from "../hooks/useUpdateProjectResourceGrants";
import ProjectAppResourceTargetFields from "./ProjectAppResourceTargetFields";
import {
  formatPermissionLabel,
  APP_RESOURCE_KINDS,
  KIND_LABELS,
  mergePermissionOptionsForKind,
  type AppResourceKind,
  AppResourceKindSlug,
} from "../types/appResourceKinds";
import { createEmptyAppResource, duplicateAppResourceKeys, nextAppResourceKey } from "../utils/appResourceRows";

interface IProjectAppResourceGrantsEditorProps {
  projectId: string;
  target: IWorkspaceAppDeploymentTarget | null;
  requiredResources: readonly IWorkspaceAppResource[];
  canEdit: boolean;
  isLinked: boolean;
  onReload?: () => void;
}

/** Edits app service-principal resource grants for the linked child App. */
function ProjectAppResourceGrantsEditor({
  projectId,
  target,
  requiredResources,
  canEdit,
  isLinked,
  onReload,
}: Readonly<IProjectAppResourceGrantsEditorProps>) {
  const [resources, setResources] = useState<IWorkspaceAppResource[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [addKind, setAddKind] = useState<AppResourceKind | "">("");
  const saveMutation = useUpdateProjectResourceGrants();
  const duplicateKeys = duplicateAppResourceKeys(resources);
  const conflict =
    saveMutation.isError &&
    ((saveMutation.error instanceof Error &&
      /reload from databricks/i.test(saveMutation.error.message)) ||
      (typeof saveMutation.error === "object" &&
        saveMutation.error !== null &&
        "status" in saveMutation.error &&
        saveMutation.error.status === 409));

  useEffect(() => {
    setResources(target?.appResources ?? []);
  }, [target?.appResources]);

  function cancelEditing() {
    setResources(target?.appResources ?? []);
    setIsEditing(false);
    saveMutation.reset();
  }

  const isDirty = Boolean(
    target && JSON.stringify(resources) !== JSON.stringify(target.appResources),
  );

  function isRequired(resource: IWorkspaceAppResource): boolean {
    return requiredResources.some(
      (required) => sameResourceBinding(required, resource),
    );
  }

  function addSelectedKind() {
    if (!addKind) return;
    const name = nextAppResourceKey(addKind, resources);
    setResources((current) => [...current, createEmptyAppResource(addKind, name)]);
    setAddKind("");
  }

  function updatePermission(name: string, permission: string) {
    setResources((current) => current.map((resource) =>
      resource.name === name ? withPermission(resource, permission) : resource,
    ));
  }

  function replaceResource(name: string, next: IWorkspaceAppResource) {
    setResources((current) => current.map((resource) => resource.name === name ? next : resource));
  }

  async function save() {
    if (!canEdit || !target || !isDirty || saveMutation.isPending || duplicateKeys.length > 0) return;
    try {
      await saveMutation.mutateAsync({
        projectId,
        resources,
        ...(target.appUpdateTime ? { expectedUpdateTime: target.appUpdateTime } : {}),
      });
      setIsEditing(false);
    } catch {
      // The mutation error remains visible in the editor for a retry.
    }
  }

  return (
    <section aria-labelledby="resource-grants-heading" className="space-y-4 rounded-xl border border-border bg-card p-5">
      <header>
        <h3 id="resource-grants-heading" className="text-base font-semibold">App resources</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Specify what resources the App service principal can access. Click Edit
          to change resources; Save resources writes updates to Databricks.
          Current project bindings are required.
        </p>
        <p className="mt-1 text-sm">
          <a
            className="underline underline-offset-4"
            href="https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources"
            target="_blank"
            rel="noopener noreferrer"
          >
            Databricks Apps resources
          </a>
        </p>
        {target?.computeState && (
          <p className="mt-2 text-sm text-muted-foreground">
            Compute: {target.computeState}
          </p>
        )}
      </header>

      {!target ? (
        <p role="status" className="text-sm text-muted-foreground">Choose or deploy a child App to manage its resource grants.</p>
      ) : !isLinked ? (
        <p role="status" className="text-sm text-muted-foreground">Deploy to link this Databricks App to the project before editing its grants.</p>
      ) : target.unsupportedResourceCount > 0 ? (
        <p role="alert" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          This App has {target.unsupportedResourceCount} resource type(s) this editor cannot safely preserve. Review its complete resource list in Databricks before changing grants.
        </p>
      ) : (
        <>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
              {isEditing ? (
                <>
                  <Button type="button" disabled={!isDirty || saveMutation.isPending || duplicateKeys.length > 0} onClick={() => void save()}>
                    {saveMutation.isPending ? "Saving…" : "Save resources"}
                  </Button>
                  <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={cancelEditing}>Cancel</Button>
                </>
              ) : (
                <Button type="button" variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
              )}
            </div>
          )}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[44rem] table-fixed text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-[7.5rem] px-3 py-2">Key</th>
                  <th className="w-[8.5rem] px-3 py-2">Type</th>
                  <th className="min-w-[14rem] px-3 py-2">Details</th>
                  <th className="w-[12rem] px-3 py-2">Permission</th>
                  <th className="w-[5.5rem] px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resources.map((resource) => {
                  const required = isRequired(resource);
                  const type = resourceType(resource);
                  return (
                    <tr key={resource.name} className="border-t border-border align-top">
                      <td className="px-3 py-3 font-medium">
                        {resource.name}
                        {required && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            Required
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">{type}</td>
                      <td className="min-w-0 px-3 py-3">
                        {isEditing ? (
                          <ProjectAppResourceTargetFields
                            resource={resource}
                            onChange={(next) =>
                              replaceResource(resource.name, next)
                            }
                          />
                        ) : (
                          <span className="break-all">
                            {resourceDetails(resource)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {permissionOptions(resource).length > 1 ? (
                          <select
                            aria-label={`Permission for ${resource.name}`}
                            className="h-9 w-full min-w-[10rem] rounded-md border border-input bg-background px-2"
                            value={resourcePermission(resource)}
                            disabled={!canEdit || !isEditing || required}
                            onChange={(event) =>
                              updatePermission(
                                resource.name,
                                event.target.value,
                              )
                            }
                          >
                            {permissionOptions(resource).map((value) => (
                              <option key={value} value={value}>
                                {formatPermissionLabel(value)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="whitespace-normal break-words">
                            {formatPermissionLabel(resourcePermission(resource))}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {!required && isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!canEdit}
                            onClick={() =>
                              setResources((current) =>
                                current.filter(
                                  (item) => item.name !== resource.name,
                                ),
                              )
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {resources.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-5 text-center text-muted-foreground"
                    >
                      No resource grants are configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {duplicateKeys.length > 0 && (
            <p role="status" className="text-sm text-destructive">Duplicate resource keys: {duplicateKeys.join(", ")}. Keys must be unique.</p>
          )}
          {isEditing && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                <span>Resource type</span>
                <select aria-label="Resource type" className="h-10 rounded-md border border-input bg-background px-3" value={addKind} onChange={(event) => setAddKind(event.target.value as AppResourceKind | "")}>
                  <option value="">Choose a type</option>
                  {APP_RESOURCE_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
                </select>
              </label>
              <Button type="button" variant="outline" disabled={!addKind} onClick={addSelectedKind}>Add resource</Button>
            </div>
          )}
          {conflict && onReload && (
            <div role="alert" className="rounded-md border border-warning/40 bg-warning-subtle p-3 text-sm">
              <p>The App resources changed in Databricks.</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onReload}>Reload from Databricks</Button>
            </div>
          )}
          {saveMutation.isError && !conflict && <p role="alert" className="text-sm text-destructive">{saveMutation.error instanceof Error ? saveMutation.error.message : "Resource grants could not be updated."}</p>}
          {saveMutation.isSuccess && <p role="status" className="text-sm text-muted-foreground">Grant update submitted to Databricks.</p>}
        </>
      )}
    </section>
  );
}

function resourceType(resource: IWorkspaceAppResource): string {
  if ("postgres" in resource) return "Lakebase Autoscaling";
  if ("database" in resource) return "Lakebase Provisioned";
  if ("sql_warehouse" in resource) return "SQL warehouse";
  if ("job" in resource) return "Job";
  if ("experiment" in resource) return "Experiment";
  if ("genie_space" in resource) return "Genie space";
  if ("serving_endpoint" in resource) return "Serving endpoint";
  if ("uc_securable" in resource) return "Unity Catalog securable";
  return "Secret";
}

function resourceDetails(resource: IWorkspaceAppResource): string {
  if ("postgres" in resource) return resource.postgres.database;
  if ("database" in resource) return `${resource.database.instance_name} / ${resource.database.database_name}`;
  if ("sql_warehouse" in resource) return resource.sql_warehouse.id;
  if ("job" in resource) return resource.job.id;
  if ("experiment" in resource) return resource.experiment.experiment_id;
  if ("genie_space" in resource) return `${resource.genie_space.name} / ${resource.genie_space.space_id}`;
  if ("serving_endpoint" in resource) return resource.serving_endpoint.name;
  if ("uc_securable" in resource) return `${resource.uc_securable.securable_type}: ${resource.uc_securable.securable_full_name}`;
  return `${resource.secret.scope} / ${resource.secret.key}`;
}

function resourcePermission(resource: IWorkspaceAppResource): string {
  if ("secret" in resource) return resource.secret.permission;
  if ("sql_warehouse" in resource) return resource.sql_warehouse.permission;
  if ("postgres" in resource || "database" in resource) return "CAN_CONNECT_AND_CREATE";
  if ("job" in resource) return resource.job.permission;
  if ("experiment" in resource) return resource.experiment.permission;
  if ("genie_space" in resource) return resource.genie_space.permission;
  if ("serving_endpoint" in resource) return resource.serving_endpoint.permission;
  if ("uc_securable" in resource) return resource.uc_securable.permission;
  return "";
}

function permissionOptions(resource: IWorkspaceAppResource): readonly string[] {
  const kind = resourceKind(resource);
  if (!kind) return ["CAN_MANAGE", "CAN_USE"];
  return mergePermissionOptionsForKind(kind, resourcePermission(resource));
}

function resourceKind(resource: IWorkspaceAppResource): AppResourceKind | null {
  if ("secret" in resource) return AppResourceKindSlug.Secret;
  if ("sql_warehouse" in resource) return AppResourceKindSlug.SqlWarehouse;
  if ("job" in resource) return AppResourceKindSlug.Job;
  if ("experiment" in resource) return AppResourceKindSlug.Experiment;
  if ("genie_space" in resource) return AppResourceKindSlug.GenieSpace;
  if ("serving_endpoint" in resource) return AppResourceKindSlug.ServingEndpoint;
  if ("uc_securable" in resource) return AppResourceKindSlug.UcSecurable;
  if ("postgres" in resource) return AppResourceKindSlug.AutoscalingDatabase;
  if ("database" in resource) return AppResourceKindSlug.Database;
  return null;
}

function withPermission(resource: IWorkspaceAppResource, permission: string): IWorkspaceAppResource {
  if (!permissionOptions(resource).includes(permission)) return resource;
  if ("secret" in resource) return { ...resource, secret: { ...resource.secret, permission: permission as typeof resource.secret.permission } };
  if ("sql_warehouse" in resource) return { ...resource, sql_warehouse: { ...resource.sql_warehouse, permission: permission as typeof resource.sql_warehouse.permission } };
  if ("job" in resource) return { ...resource, job: { ...resource.job, permission: permission as typeof resource.job.permission } };
  if ("experiment" in resource) return { ...resource, experiment: { ...resource.experiment, permission: permission as typeof resource.experiment.permission } };
  if ("genie_space" in resource) return { ...resource, genie_space: { ...resource.genie_space, permission: permission as typeof resource.genie_space.permission } };
  if ("serving_endpoint" in resource) return { ...resource, serving_endpoint: { ...resource.serving_endpoint, permission: permission as typeof resource.serving_endpoint.permission } };
  if ("uc_securable" in resource) return { ...resource, uc_securable: { ...resource.uc_securable, permission: permission as typeof resource.uc_securable.permission } };
  return resource;
}

function sameResourceBinding(
  first: IWorkspaceAppResource,
  second: IWorkspaceAppResource,
): boolean {
  if (first.name !== second.name) return false;
  if ("secret" in first && "secret" in second) {
    return first.secret.scope === second.secret.scope &&
      first.secret.key === second.secret.key &&
      first.secret.permission === second.secret.permission;
  }
  if ("sql_warehouse" in first && "sql_warehouse" in second) {
    return first.sql_warehouse.id === second.sql_warehouse.id &&
      first.sql_warehouse.permission === second.sql_warehouse.permission;
  }
  if ("postgres" in first && "postgres" in second) {
    return first.postgres.database === second.postgres.database;
  }
  if ("database" in first && "database" in second) {
    return first.database.instance_name === second.database.instance_name &&
      first.database.database_name === second.database.database_name;
  }
  if ("job" in first && "job" in second) return first.job.id === second.job.id && first.job.permission === second.job.permission;
  if ("experiment" in first && "experiment" in second) return first.experiment.experiment_id === second.experiment.experiment_id && first.experiment.permission === second.experiment.permission;
  if ("genie_space" in first && "genie_space" in second) return first.genie_space.space_id === second.genie_space.space_id && first.genie_space.permission === second.genie_space.permission;
  if ("serving_endpoint" in first && "serving_endpoint" in second) return first.serving_endpoint.name === second.serving_endpoint.name && first.serving_endpoint.permission === second.serving_endpoint.permission;
  if ("uc_securable" in first && "uc_securable" in second) return first.uc_securable.securable_full_name === second.uc_securable.securable_full_name && first.uc_securable.permission === second.uc_securable.permission;
  return false;
}

export default ProjectAppResourceGrantsEditor;
