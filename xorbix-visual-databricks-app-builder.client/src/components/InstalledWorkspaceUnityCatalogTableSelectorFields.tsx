import { useEffect, useState } from "react";
import { useWorkspaceCatalogs } from "../hooks/useWorkspaceCatalogs";
import { useWorkspaceSchemas } from "../hooks/useWorkspaceSchemas";
import { useWorkspaceTables } from "../hooks/useWorkspaceTables";
import type { IWorkspaceTable } from "../models/WorkspaceTable";
import InstalledWorkspaceResourceSelect from "./InstalledWorkspaceResourceSelect";

export interface InstalledWorkspaceUnityCatalogTableValue {
  catalog: string;
  schema: string;
  table: string;
}

interface InstalledWorkspaceUnityCatalogTableSelectorFieldsProps {
  value: InstalledWorkspaceUnityCatalogTableValue;
  onChange: (next: InstalledWorkspaceUnityCatalogTableValue) => void;
}

/** Selects a Unity Catalog table through the installed app's user-authorized Node API. */
export default function InstalledWorkspaceUnityCatalogTableSelectorFields({
  value,
  onChange,
}: Readonly<InstalledWorkspaceUnityCatalogTableSelectorFieldsProps>) {
  const [selectedCatalog, setSelectedCatalog] = useState(value.catalog);
  const [selectedSchema, setSelectedSchema] = useState(value.schema);
  const catalogsQuery = useWorkspaceCatalogs();
  const schemasQuery = useWorkspaceSchemas(selectedCatalog || null);
  const tablesQuery = useWorkspaceTables(selectedCatalog || null, selectedSchema || null);

  useEffect(() => setSelectedCatalog(value.catalog), [value.catalog]);
  useEffect(() => setSelectedSchema(value.schema), [value.schema]);

  function updateCatalog(catalog: string) {
    setSelectedCatalog(catalog);
    setSelectedSchema("");
    onChange({ catalog, schema: "", table: "" });
  }

  function updateSchema(schema: string) {
    setSelectedSchema(schema);
    onChange({ catalog: selectedCatalog, schema, table: "" });
  }

  function updateTable(table: string) {
    onChange({ catalog: selectedCatalog, schema: selectedSchema, table });
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <InstalledWorkspaceResourceSelect
        label="Catalog"
        value={selectedCatalog}
        placeholder="Select a catalog"
        options={catalogsQuery.data?.items.map((item) => ({ value: item.name, label: item.name })) ?? []}
        loading={catalogsQuery.isPending}
        error={catalogsQuery.error}
        onChange={updateCatalog}
      />
      <InstalledWorkspaceResourceSelect
        label="Schema"
        value={selectedSchema}
        placeholder={selectedCatalog ? "Select a schema" : "Select a catalog first"}
        options={schemasQuery.data?.items.map((item) => ({ value: item.name, label: item.name })) ?? []}
        loading={schemasQuery.isPending}
        error={schemasQuery.error}
        disabled={!selectedCatalog}
        onChange={updateSchema}
      />
      <InstalledWorkspaceResourceSelect
        label="Table"
        value={value.table}
        placeholder={selectedSchema ? "Select a table" : "Select a schema first"}
        options={tablesQuery.data?.items.map((item: IWorkspaceTable) => ({ value: item.name, label: item.name })) ?? []}
        loading={tablesQuery.isPending}
        error={tablesQuery.error}
        disabled={!selectedSchema}
        onChange={updateTable}
      />
    </div>
  );
}
