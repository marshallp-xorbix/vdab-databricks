import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { useWorkspaceCatalogs } from "../hooks/useWorkspaceCatalogs";
import { useWorkspaceSchemas } from "../hooks/useWorkspaceSchemas";
import { useWorkspaceTables } from "../hooks/useWorkspaceTables";
import InstalledWorkspaceResourceSelect from "./InstalledWorkspaceResourceSelect";
import { Input } from "./ui/input";

type OnChange = (resource: IWorkspaceAppResource) => void;

/** Catalog/schema/table pickers for Unity Catalog TABLE grants. */
export default function ProjectAppResourceUcTargetFields({
  resource,
  onChange,
}: Readonly<{
  resource: Extract<IWorkspaceAppResource, { uc_securable: unknown }>;
  onChange: OnChange;
}>) {
  const isTable = resource.uc_securable.securable_type === "TABLE";
  const parts = resource.uc_securable.securable_full_name.split(".");
  const catalogName = isTable ? (parts[0] ?? "") : "";
  const schemaName = isTable ? (parts[1] ?? "") : "";
  const tableName = isTable ? (parts[2] ?? "") : "";
  const catalogs = useWorkspaceCatalogs();
  const schemas = useWorkspaceSchemas(catalogName || null);
  const tables = useWorkspaceTables(catalogName || null, schemaName || null);

  return (
    <div className="grid min-w-0 gap-2">
      <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
        <span>{`Securable type for ${resource.name}`}</span>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-2"
          value={resource.uc_securable.securable_type}
          onChange={(event) =>
            onChange({
              ...resource,
              uc_securable: {
                ...resource.uc_securable,
                securable_type: event.target
                  .value as typeof resource.uc_securable.securable_type,
                securable_full_name: "",
              },
            })
          }
        >
          {["TABLE", "VOLUME", "FUNCTION", "CONNECTION", "MODEL_SERVICE"].map(
            (value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ),
          )}
        </select>
      </label>
      {isTable ? (
        <>
          <InstalledWorkspaceResourceSelect
            label={`Catalog for ${resource.name}`}
            value={catalogName}
            emptyLabel="No catalogs found"
            placeholder="Select a catalog…"
            options={(catalogs.data?.items ?? []).map((item) => ({
              value: item.name,
              label: item.name,
            }))}
            loading={catalogs.isPending}
            error={catalogs.error}
            onChange={(nextCatalog) =>
              onChange({
                ...resource,
                uc_securable: {
                  ...resource.uc_securable,
                  securable_full_name: nextCatalog,
                },
              })
            }
          />
          <InstalledWorkspaceResourceSelect
            label={`Schema for ${resource.name}`}
            value={schemaName}
            emptyLabel="No schemas found"
            placeholder={
              catalogName ? "Select a schema…" : "Select a catalog first"
            }
            options={(schemas.data?.items ?? []).map((item) => ({
              value: item.name,
              label: item.name,
            }))}
            loading={schemas.isPending}
            error={schemas.error}
            disabled={!catalogName}
            onChange={(nextSchema) =>
              onChange({
                ...resource,
                uc_securable: {
                  ...resource.uc_securable,
                  securable_full_name: `${catalogName}.${nextSchema}`,
                },
              })
            }
          />
          <InstalledWorkspaceResourceSelect
            label={`Table for ${resource.name}`}
            value={tableName}
            emptyLabel="No tables found"
            placeholder={
              schemaName ? "Select a table…" : "Select a schema first"
            }
            options={(tables.data?.items ?? []).map((item) => ({
              value: item.name,
              label: item.name,
            }))}
            loading={tables.isPending}
            error={tables.error}
            disabled={!schemaName}
            onChange={(nextTable) =>
              onChange({
                ...resource,
                uc_securable: {
                  ...resource.uc_securable,
                  securable_full_name: `${catalogName}.${schemaName}.${nextTable}`,
                },
              })
            }
          />
        </>
      ) : (
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
          <span>{`Catalog schema and name for ${resource.name}`}</span>
          <Input
            value={resource.uc_securable.securable_full_name}
            maxLength={255}
            placeholder="catalog.schema.name"
            onChange={(event) =>
              onChange({
                ...resource,
                uc_securable: {
                  ...resource.uc_securable,
                  securable_full_name: event.target.value,
                },
              })
            }
          />
        </label>
      )}
    </div>
  );
}
