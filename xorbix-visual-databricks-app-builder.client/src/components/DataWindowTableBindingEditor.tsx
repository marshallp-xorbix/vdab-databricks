import { Label } from "./ui/label";
import { useWorkspaceCatalogs } from "../hooks/useWorkspaceCatalogs";
import { useWorkspaceSchemas } from "../hooks/useWorkspaceSchemas";
import { useWorkspaceTables } from "../hooks/useWorkspaceTables";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import {
  createUnityCatalogTableBinding,
  createUnityCatalogTableSelection,
  hasUnsupportedDataWindowBinding,
  readUnityCatalogTableBinding,
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
  const selection = readUnityCatalogTableBinding(bindings);
  const catalogs = useWorkspaceCatalogs();
  const schemas = useWorkspaceSchemas(selection?.catalog ?? null);
  const tables = useWorkspaceTables(
    selection?.catalog ?? null,
    selection?.schema ?? null,
  );

  function changeCatalog(catalog: string) {
    if (catalog === "") {
      onBindingsChange(null);
      return;
    }

    onBindingsChange(createUnityCatalogTableBinding(
      createUnityCatalogTableSelection(catalog, null, null),
    ));
  }

  function changeSchema(schema: string) {
    if (!selection?.catalog) {
      return;
    }

    onBindingsChange(createUnityCatalogTableBinding(
      createUnityCatalogTableSelection(selection.catalog, schema || null, null),
    ));
  }

  function changeTable(tableName: string) {
    if (!selection?.catalog || !selection.schema) {
      return;
    }

    const table = tables.data?.items.find((item) => item.name === tableName) ?? null;
    onBindingsChange(createUnityCatalogTableBinding(
      createUnityCatalogTableSelection(selection.catalog, selection.schema, table),
    ));
  }

  function changePrimaryKey(primaryKeyColumn: string) {
    if (selection) {
      onBindingsChange(createUnityCatalogTableBinding({
        ...selection,
        primaryKeyColumn: primaryKeyColumn || null,
      }));
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Data source</legend>
      <div className="grid gap-2">
        <Label htmlFor={`data-window-catalog-${componentKey}`}>Current-workspace catalog</Label>
        <select
          id={`data-window-catalog-${componentKey}`}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selection?.catalog ?? ""}
          onChange={(event) => changeCatalog(event.target.value)}
        >
          <option value="">No table selected</option>
          {includeCurrentSelection(
            catalogs.data?.items.map((item) => item.name) ?? [],
            selection?.catalog,
          ).map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {catalogs.isPending && <p role="status" className="text-xs text-muted-foreground">Loading catalogs…</p>}
        {catalogs.isError && <p role="alert" className="text-xs text-destructive">{catalogs.error.message}</p>}
        {!catalogs.isPending && !catalogs.isError && (catalogs.data?.items.length ?? 0) === 0 && (
          <p role="status" className="text-xs text-muted-foreground">No catalogs are visible to this user.</p>
        )}
      </div>
      {selection?.catalog && (
        <>
          <ResourceSelect
            id={`data-window-schema-${componentKey}`}
            label="Schema"
            value={selection.schema ?? ""}
            options={includeCurrentSelection(
              schemas.data?.items.map((item) => item.name) ?? [],
              selection.schema,
            )}
            disabled={!selection.catalog || schemas.isPending || schemas.isError}
            onChange={changeSchema}
            isPending={schemas.isPending}
            error={schemas.isError ? schemas.error.message : null}
            emptyMessage="No schemas are visible in this catalog."
          />
          {selection.schema && (
            <ResourceSelect
              id={`data-window-table-${componentKey}`}
              label="Table"
              value={selection.table ?? ""}
              options={includeCurrentSelection(
                tables.data?.items.map((item) => item.name) ?? [],
                selection.table,
              )}
              disabled={!selection.schema || tables.isPending || tables.isError}
              onChange={changeTable}
              isPending={tables.isPending}
              error={tables.isError ? tables.error.message : null}
              emptyMessage="No tables are visible in this schema."
            />
          )}
          {!tables.isPending && !tables.isError && selection.table &&
            !tables.data?.items.some((item) => item.name === selection.table) && (
              <p role="status" className="text-xs text-muted-foreground">
                The saved table is not in the current results. It may be inaccessible or no longer exist.
              </p>
            )}
        </>
      )}
      {primaryKeyRequired && selection?.table && selection.dataSourceFormat === "DELTA" && (
        <div className="grid gap-2">
          <Label htmlFor={`data-window-primary-key-${componentKey}`}>Primary key column</Label>
          <select
            id={`data-window-primary-key-${componentKey}`}
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
            The generated app checks the whole table for duplicate or null keys before each save.
          </p>
          {!selection.primaryKeyColumn && (
            <p role="status" className="text-xs text-muted-foreground">
              Choose a unique, non-null key column before saving editable table changes.
            </p>
          )}
        </div>
      )}
      {primaryKeyRequired && selection?.table && selection.dataSourceFormat !== "DELTA" && (
        <p role="status" className="text-sm text-muted-foreground">
          This table is available for viewing, but row saves require a Unity Catalog Delta table. The installed workspace did not report DELTA format for this table.
        </p>
      )}
      {hasUnsupportedDataWindowBinding(bindings) && (
        <p role="status" className="text-sm text-muted-foreground">
          The saved Lakebase table binding is preserved. Choose a Unity Catalog table to change this binding.
        </p>
      )}
    </fieldset>
  );
}

interface IResourceSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  isPending: boolean;
  error: string | null;
  emptyMessage: string;
  onChange: (value: string) => void;
}

function ResourceSelect({
  id,
  label,
  value,
  options,
  disabled,
  isPending,
  error,
  emptyMessage,
  onChange,
}: Readonly<IResourceSelectProps>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select a {label.toLowerCase()}</option>
        {options.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      {isPending && <p role="status" className="text-xs text-muted-foreground">Loading {label.toLowerCase()}…</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {!isPending && !error && options.length === 0 && (
        <p role="status" className="text-xs text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  );
}

function includeCurrentSelection(options: string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

export default DataWindowTableBindingEditor;
