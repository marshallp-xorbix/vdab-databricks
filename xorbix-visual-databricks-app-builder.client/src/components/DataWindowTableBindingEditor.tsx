import { Label } from "./ui/label";
import { useWorkspaceCatalogs } from "../hooks/useWorkspaceCatalogs";
import { useWorkspaceSchemas } from "../hooks/useWorkspaceSchemas";
import { useWorkspaceTables } from "../hooks/useWorkspaceTables";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import DataWindowLakebaseBindingFields from "./DataWindowLakebaseBindingFields";
import DataWindowResourceSelect from "./DataWindowResourceSelect";
import {
  createUnityCatalogTableBinding,
  createUnityCatalogTableSelection,
  createLakebaseAutoscalingTableBinding,
  createLakebaseProvisionedTableBinding,
  hasUnsupportedDataWindowBinding,
  readProjectTableBinding,
} from "../utils/projectDataWindowBinding";

interface IDataWindowTableBindingEditorProps {
  componentKey: string;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  primaryKeyRequired: boolean;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function DataWindowTableBindingEditor({
  componentKey,
  bindings,
  disabled,
  primaryKeyRequired,
  onBindingsChange,
}: Readonly<IDataWindowTableBindingEditorProps>) {
  const selection = readProjectTableBinding(bindings);
  const unityCatalogSelection = selection?.kind === "unityCatalogTable"
    ? selection
    : selection === null
    ? emptyUnityCatalogSelection()
    : null;
  const catalogs = useWorkspaceCatalogs();
  const schemas = useWorkspaceSchemas(unityCatalogSelection?.catalog ?? null);
  const tables = useWorkspaceTables(
    unityCatalogSelection?.catalog ?? null,
    unityCatalogSelection?.schema ?? null,
  );

  function changeSource(kind: string) {
    if (kind === "") {
      onBindingsChange(null);
    } else if (kind === "unityCatalogTable") {
      onBindingsChange(createUnityCatalogTableBinding(emptyUnityCatalogSelection()));
    } else if (kind === "lakebaseAutoscaling") {
      onBindingsChange(createLakebaseAutoscalingTableBinding(emptyLakebaseSelection("lakebaseAutoscaling")));
    } else if (kind === "lakebaseProvisionedDatabase") {
      onBindingsChange(createLakebaseProvisionedTableBinding(emptyLakebaseSelection("lakebaseProvisionedDatabase")));
    }
  }

  function changeCatalog(catalog: string) {
    if (catalog === "") {
      onBindingsChange(null);
      return;
    }

    onBindingsChange(createUnityCatalogTableBinding(createUnityCatalogTableSelection(catalog, null, null)));
  }

  function changeSchema(schema: string) {
    if (!unityCatalogSelection?.catalog) {
      return;
    }

    onBindingsChange(createUnityCatalogTableBinding(
      createUnityCatalogTableSelection(unityCatalogSelection.catalog, schema || null, null),
    ));
  }

  function changeTable(tableName: string) {
    if (!unityCatalogSelection?.catalog || !unityCatalogSelection.schema) {
      return;
    }

    const table = tables.data?.items.find((item) => item.name === tableName) ?? null;
    onBindingsChange(createUnityCatalogTableBinding(
      createUnityCatalogTableSelection(unityCatalogSelection.catalog, unityCatalogSelection.schema, table),
    ));
  }

  function changePrimaryKey(primaryKeyColumn: string) {
    if (selection) {
      const next = { ...selection, primaryKeyColumn: primaryKeyColumn || null };
      const nextBindings = selection.kind === "unityCatalogTable"
        ? createUnityCatalogTableBinding(next)
        : selection.kind === "lakebaseAutoscaling"
        ? createLakebaseAutoscalingTableBinding(next)
        : createLakebaseProvisionedTableBinding(next);
      onBindingsChange(nextBindings);
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Data source</legend>
      <div className="grid gap-2">
        <Label htmlFor={`data-window-source-${componentKey}`}>Workspace table source</Label>
        <select
          id={`data-window-source-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selection?.kind ?? "unityCatalogTable"}
          onChange={(event) => changeSource(event.target.value)}
        >
          <option value="">No table selected</option>
          <option value="unityCatalogTable">Unity Catalog</option>
          <option value="lakebaseAutoscaling">Lakebase Autoscaling</option>
          <option value="lakebaseProvisionedDatabase">Lakebase Provisioned (existing)</option>
        </select>
      </div>
      {unityCatalogSelection !== null && (
      <>
      <div className="grid gap-2">
        <Label htmlFor={`data-window-catalog-${componentKey}`}>Current-workspace catalog</Label>
        <select
          id={`data-window-catalog-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={unityCatalogSelection.catalog ?? ""}
          onChange={(event) => changeCatalog(event.target.value)}
        >
          <option value="">No table selected</option>
          {includeCurrentSelection(
            catalogs.data?.items.map((item) => item.name) ?? [],
            unityCatalogSelection.catalog,
          ).map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {catalogs.isPending && <p role="status" className="text-xs text-muted-foreground">Loading catalogs…</p>}
        {catalogs.isError && <p role="alert" className="text-xs text-destructive">{catalogs.error.message}</p>}
        {!catalogs.isPending && !catalogs.isError && (catalogs.data?.items.length ?? 0) === 0 && (
          <p role="status" className="text-xs text-muted-foreground">No catalogs are visible to this user.</p>
        )}
      </div>
      {unityCatalogSelection.catalog && (
        <>
          <DataWindowResourceSelect
            id={`data-window-schema-${componentKey}`}
            label="Schema"
            value={unityCatalogSelection.schema ?? ""}
            options={includeCurrentSelection(
              schemas.data?.items.map((item) => item.name) ?? [],
              unityCatalogSelection.schema,
            )}
            disabled={!unityCatalogSelection.catalog || schemas.isPending || schemas.isError}
            onChange={changeSchema}
            isPending={schemas.isPending}
            error={schemas.isError ? schemas.error.message : null}
            emptyMessage="No schemas are visible in this catalog."
          />
          {unityCatalogSelection.schema && (
            <DataWindowResourceSelect
              id={`data-window-table-${componentKey}`}
              label="Table"
              value={unityCatalogSelection.table ?? ""}
              options={includeCurrentSelection(
                tables.data?.items.map((item) => item.name) ?? [],
                unityCatalogSelection.table,
              )}
              disabled={!unityCatalogSelection.schema || tables.isPending || tables.isError}
              onChange={changeTable}
              isPending={tables.isPending}
              error={tables.isError ? tables.error.message : null}
              emptyMessage="No tables are visible in this schema."
            />
          )}
          {!tables.isPending && !tables.isError && unityCatalogSelection.table &&
            !tables.data?.items.some((item) => item.name === unityCatalogSelection.table) && (
              <p role="status" className="text-xs text-muted-foreground">
                The saved table is not in the current results. It may be inaccessible or no longer exist.
              </p>
            )}
        </>
      )}
      {primaryKeyRequired && unityCatalogSelection.table && unityCatalogSelection.dataSourceFormat === "DELTA" && (
        <div className="grid gap-2">
          <Label htmlFor={`data-window-primary-key-${componentKey}`}>Primary key column</Label>
          <select
            id={`data-window-primary-key-${componentKey}`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={unityCatalogSelection.primaryKeyColumn ?? ""}
            onChange={(event) => changePrimaryKey(event.target.value)}
          >
            <option value="">Select a primary key</option>
            {unityCatalogSelection.columns.map((column) => (
              <option key={column.name} value={column.name}>{column.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            The generated app checks the whole table for duplicate or null keys before each save.
          </p>
          {!unityCatalogSelection.primaryKeyColumn && (
            <p role="status" className="text-xs text-muted-foreground">
              Choose a unique, non-null key column before saving editable table changes.
            </p>
          )}
        </div>
      )}
      {primaryKeyRequired && unityCatalogSelection.table && unityCatalogSelection.dataSourceFormat !== "DELTA" && (
        <p role="status" className="text-sm text-muted-foreground">
          This table is available for viewing, but row saves require a Unity Catalog Delta table. The installed workspace did not report DELTA format for this table.
        </p>
      )}
      </>
      )}
      {(selection?.kind === "lakebaseAutoscaling" || selection?.kind === "lakebaseProvisionedDatabase") && (
        <DataWindowLakebaseBindingFields
          kind={selection.kind}
          binding={selection}
          onBindingsChange={onBindingsChange}
        />
      )}
      {primaryKeyRequired && selection?.kind !== "unityCatalogTable" && selection?.table && (
        <div className="grid gap-2">
          <Label htmlFor={`data-window-lakebase-primary-key-${componentKey}`}>Primary key column</Label>
          <select
            id={`data-window-lakebase-primary-key-${componentKey}`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selection.primaryKeyColumn ?? ""}
            onChange={(event) => changePrimaryKey(event.target.value)}
          >
            <option value="">Select a primary key</option>
            {selection.columns.map((column) => (
              <option key={column.name} value={column.name}>{column.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            The generated app checks the table for duplicate or null keys before saving edits.
          </p>
          {!selection.primaryKeyColumn && (
            <p role="status" className="text-xs text-muted-foreground">
              Choose a unique, non-null key column before saving editable table changes.
            </p>
          )}
        </div>
      )}
      {hasUnsupportedDataWindowBinding(bindings) && (
        <p role="status" className="text-sm text-muted-foreground">
          The saved Lakebase table binding is preserved. Choose a Unity Catalog table to change this binding.
        </p>
      )}
    </fieldset>
  );
}

function emptyUnityCatalogSelection() {
  return {
    kind: "unityCatalogTable" as const,
    catalog: null,
    schema: null,
    table: null,
    dataSourceFormat: null,
    primaryKeyColumn: null,
    columns: [],
    database: null,
    instanceName: null,
    projectId: null,
    branchId: null,
    endpointId: null,
  };
}

function emptyLakebaseSelection(
  kind: "lakebaseAutoscaling" | "lakebaseProvisionedDatabase",
) {
  return {
    kind,
    catalog: null,
    schema: null,
    table: null,
    dataSourceFormat: null,
    primaryKeyColumn: null,
    columns: [],
    database: kind === "lakebaseProvisionedDatabase" ? "databricks_postgres" : null,
    instanceName: null,
    projectId: null,
    branchId: null,
    endpointId: null,
  } as const;
}

function includeCurrentSelection(options: string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

export default DataWindowTableBindingEditor;
