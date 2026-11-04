import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type {
  IWorkspaceAppDeploymentTarget,
  IWorkspaceAppResource,
} from "../models/ProjectDeployments";
import { useUpdateProjectResourceGrants } from "../hooks/useUpdateProjectResourceGrants";
import { useWorkspaceSqlWarehouses } from "../hooks/useWorkspaceSqlWarehouses";

interface IProjectAppResourceGrantsEditorProps {
  projectId: string;
  target: IWorkspaceAppDeploymentTarget | null;
  requiredResources: readonly IWorkspaceAppResource[];
  canEdit: boolean;
  isLinked: boolean;
}

/** Edits app service-principal resource grants for the linked child App. */
function ProjectAppResourceGrantsEditor({
  projectId,
  target,
  requiredResources,
  canEdit,
  isLinked,
}: Readonly<IProjectAppResourceGrantsEditorProps>) {
  const [resources, setResources] = useState<IWorkspaceAppResource[]>([]);
  const [resourceName, setResourceName] = useState("");
  const [warehouseResourceName, setWarehouseResourceName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [secretScope, setSecretScope] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [secretPermission, setSecretPermission] = useState<"READ" | "WRITE" | "MANAGE">("READ");
  const saveMutation = useUpdateProjectResourceGrants();
  const warehousesQuery = useWorkspaceSqlWarehouses(
    Boolean(target && isLinked && canEdit),
  );

  useEffect(() => {
    setResources(target?.appResources ?? []);
  }, [target?.appResources]);

  const canAddSecret =
    /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(resourceName.trim()) &&
    secretScope.trim().length > 0 &&
    secretScope.trim().length <= 128 &&
    secretKey.trim().length > 0 &&
    secretKey.trim().length <= 128 &&
    !/[\u0000-\u001f\u007f]/.test(`${secretScope}${secretKey}`) &&
    !resources.some((resource) => resource.name === resourceName.trim());
  const isDirty = Boolean(
    target && JSON.stringify(resources) !== JSON.stringify(target.appResources),
  );
  const canAddWarehouse =
    /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(warehouseResourceName.trim()) &&
    warehouseId.length > 0 &&
    !resources.some((resource) => resource.name === warehouseResourceName.trim());

  function isRequired(resource: IWorkspaceAppResource): boolean {
    return requiredResources.some(
      (required) => sameResourceBinding(required, resource),
    );
  }

  function addSecret() {
    if (!canAddSecret) return;
    setResources((current) => [
      ...current,
      {
        name: resourceName.trim(),
        description: "VDAB secret resource grant",
        secret: {
          scope: secretScope.trim(),
          key: secretKey.trim(),
          permission: secretPermission,
        },
      },
    ]);
    setResourceName("");
    setSecretScope("");
    setSecretKey("");
    setSecretPermission("READ");
  }

  function updateSecretPermission(
    name: string,
    permission: "READ" | "WRITE" | "MANAGE",
  ) {
    setResources((current) => current.map((resource) =>
      resource.name === name && "secret" in resource
        ? { ...resource, secret: { ...resource.secret, permission } }
        : resource,
    ));
  }

  function updateWarehousePermission(
    name: string,
    permission: "CAN_USE" | "CAN_MANAGE" | "IS_OWNER",
  ) {
    setResources((current) => current.map((resource) =>
      resource.name === name && "sql_warehouse" in resource
        ? { ...resource, sql_warehouse: { ...resource.sql_warehouse, permission } }
        : resource,
    ));
  }

  function addWarehouse() {
    if (!canAddWarehouse) return;
    const warehouse = warehousesQuery.data?.items.find(
      (item) => item.id === warehouseId,
    );
    if (!warehouse) return;
    setResources((current) => [
      ...current,
      {
        name: warehouseResourceName.trim(),
        description: "VDAB SQL warehouse resource grant",
        sql_warehouse: { id: warehouse.id, permission: "CAN_USE" },
      },
    ]);
    setWarehouseResourceName("");
    setWarehouseId("");
  }

  async function save() {
    if (!canEdit || !target || !isDirty || saveMutation.isPending) return;
    await saveMutation.mutateAsync({ projectId, resources });
  }

  return (
    <section aria-labelledby="resource-grants-heading" className="space-y-4 rounded-xl border border-border bg-card p-5">
      <header>
        <h3 id="resource-grants-heading" className="text-base font-semibold">App resource grants</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          These grants let the Databricks App service principal access workspace resources. The current project bindings are required and cannot be removed here.
        </p>
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
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Key</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Details</th><th className="px-3 py-2">Permission</th><th className="px-3 py-2"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {resources.map((resource) => {
                  const required = isRequired(resource);
                  const type = resourceType(resource);
                  return (
                    <tr key={resource.name} className="border-t border-border align-top">
                      <td className="px-3 py-3 font-medium">{resource.name}{required && <span className="ml-2 text-xs text-muted-foreground">Required</span>}</td>
                      <td className="px-3 py-3">{type}</td>
                      <td className="px-3 py-3">{resourceDetails(resource)}</td>
                      <td className="px-3 py-3">
                        {"secret" in resource ? (
                          <select aria-label={`Permission for ${resource.name}`} className="h-9 rounded-md border border-input bg-background px-2" value={resource.secret.permission} disabled={!canEdit || required} onChange={(event) => updateSecretPermission(resource.name, event.target.value as "READ" | "WRITE" | "MANAGE")}>
                            <option value="READ">Read</option><option value="WRITE">Write</option><option value="MANAGE">Manage</option>
                          </select>
                        ) : "sql_warehouse" in resource ? (
                          <select aria-label={`Permission for ${resource.name}`} className="h-9 rounded-md border border-input bg-background px-2" value={resource.sql_warehouse.permission} disabled={!canEdit || required} onChange={(event) => updateWarehousePermission(resource.name, event.target.value as "CAN_USE" | "CAN_MANAGE" | "IS_OWNER")}>
                            <option value="CAN_USE">Can use</option><option value="CAN_MANAGE">Can manage</option><option value="IS_OWNER">Is owner</option>
                          </select>
                        ) : "CAN_CONNECT_AND_CREATE"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {!required && (
                          <Button type="button" variant="ghost" size="sm" disabled={!canEdit} onClick={() => setResources((current) => current.filter((item) => item.name !== resource.name))}>Remove</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {resources.length === 0 && <tr><td colSpan={5} className="px-3 py-5 text-center text-muted-foreground">No resource grants are configured.</td></tr>}
              </tbody>
            </table>
          </div>

          <fieldset disabled={!canEdit} className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[1fr_1fr_1fr_150px_auto] sm:items-end">
            <legend className="px-1 text-sm font-medium">Add secret grant</legend>
            <label className="space-y-1 text-sm"><span>App resource key</span><Input value={resourceName} maxLength={30} onChange={(event) => setResourceName(event.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>Secret scope</span><Input value={secretScope} maxLength={128} onChange={(event) => setSecretScope(event.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>Secret key</span><Input value={secretKey} maxLength={128} onChange={(event) => setSecretKey(event.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>Permission</span><select className="h-10 w-full rounded-md border border-input bg-background px-3" value={secretPermission} onChange={(event) => setSecretPermission(event.target.value as "READ" | "WRITE" | "MANAGE")}><option value="READ">Read</option><option value="WRITE">Write</option><option value="MANAGE">Manage</option></select></label>
            <Button type="button" variant="outline" disabled={!canAddSecret} onClick={addSecret}>Add</Button>
          </fieldset>

          <fieldset disabled={!canEdit} className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <legend className="px-1 text-sm font-medium">Add SQL warehouse grant</legend>
            <label className="space-y-1 text-sm"><span>App resource key</span><Input value={warehouseResourceName} maxLength={30} onChange={(event) => setWarehouseResourceName(event.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>SQL warehouse</span><select className="h-10 w-full rounded-md border border-input bg-background px-3" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}><option value="">Select a warehouse…</option>{(warehousesQuery.data?.items ?? []).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
            <Button type="button" variant="outline" disabled={!canAddWarehouse || warehousesQuery.isPending} onClick={addWarehouse}>Add</Button>
            {warehousesQuery.isError && <p role="alert" className="text-sm text-destructive">{warehousesQuery.error instanceof Error ? warehousesQuery.error.message : "SQL warehouses could not be loaded."}</p>}
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {saveMutation.isError && <p role="alert" className="text-sm text-destructive">{saveMutation.error instanceof Error ? saveMutation.error.message : "Resource grants could not be updated."}</p>}
            {saveMutation.isSuccess && <p role="status" className="text-sm text-muted-foreground">Grant update submitted to Databricks.</p>}
            <Button type="button" className="ml-auto" disabled={!canEdit || !isDirty || saveMutation.isPending} onClick={() => void save()}>
              {saveMutation.isPending ? "Saving grants…" : "Save resource grants"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function resourceType(resource: IWorkspaceAppResource): string {
  if ("postgres" in resource) return "Lakebase Autoscaling";
  if ("database" in resource) return "Lakebase Provisioned";
  if ("sql_warehouse" in resource) return "SQL warehouse";
  return "Secret";
}

function resourceDetails(resource: IWorkspaceAppResource): string {
  if ("postgres" in resource) return resource.postgres.database;
  if ("database" in resource) return `${resource.database.instance_name} / ${resource.database.database_name}`;
  if ("sql_warehouse" in resource) return resource.sql_warehouse.id;
  return `${resource.secret.scope} / ${resource.secret.key}`;
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
  return false;
}

export default ProjectAppResourceGrantsEditor;
