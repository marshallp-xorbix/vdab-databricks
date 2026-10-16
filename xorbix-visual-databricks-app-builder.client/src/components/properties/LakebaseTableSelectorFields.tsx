import { useEffect, useState, type FC } from "react";
import {
  databricksDataConnectorApi,
  type UnityCatalogTable,
} from "../../providers/DatabricksDataConnectorApi";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useUnityCatalogHierarchy } from "./useUnityCatalogHierarchy";
import { useLakebaseInstancesAndDatabase } from "./useLakebaseInstancesAndDatabase";
import { useLogger } from "../../logger/useLogger";

export interface LakebaseSelectorValue {
  instanceName?: string;
  catalog?: string;
  schema?: string;
  table?: string;
  database?: string;
}

interface LakebaseTableSelectorFieldsProps {
  value: LakebaseSelectorValue;
  workspaceConnectionId?: number;
  onChange: (next: LakebaseSelectorValue) => void;
  layoutVariant?: "default" | "propertyPanel";
}

const DATABASE_PLACEHOLDER_TEXT = "Select Catalog";

export const LakebaseTableSelectorFields: FC<
  LakebaseTableSelectorFieldsProps
> = ({ value, workspaceConnectionId, onChange, layoutVariant = "default" }) => {
  const logger = useLogger("LakebaseTableSelectorFields");
  const [tables, setTables] = useState<UnityCatalogTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [selectedCatalog, setSelectedCatalog] = useState(value.catalog || "");
  const [selectedSchema, setSelectedSchema] = useState(value.schema || "");

  const {
    catalogs,
    schemas,
    loadingCatalogs,
    loadingSchemas,
    catalogError: hierarchyCatalogError,
    schemaError: hierarchySchemaError,
  } = useUnityCatalogHierarchy({
    workspaceConnectionId,
    selectedCatalog,
  });

  const { instances, loadingInstances, instanceError } =
    useLakebaseInstancesAndDatabase({
      workspaceConnectionId,
      selectedCatalog,
      selectedSchema,
      instanceName: value.instanceName,
      currentCatalog: value.catalog,
      currentDatabase: value.database,
      currentTable: value.table,
      onChange,
    });

  useEffect(() => {
    setSelectedCatalog(value.catalog || "");
  }, [value.catalog]);

  useEffect(() => {
    setSelectedSchema(value.schema || "");
  }, [value.schema]);

  useEffect(() => {
    let active = true;

    const fetchTables = async () => {
      if (active) setTableError(null);

      if (!workspaceConnectionId || workspaceConnectionId <= 0) {
        if (active) setTables([]);
        return;
      }

      if (!selectedCatalog || !selectedSchema) {
        if (active) setTables([]);
        return;
      }

      try {
        if (active) setLoadingTables(true);
        const tablesData =
          await databricksDataConnectorApi.getUnityCatalogTables(
            workspaceConnectionId,
            selectedCatalog,
            selectedSchema,
          );
        if (active) setTables(tablesData || []);
      } catch (err) {
        logger.UI.error(
          "[LakebaseTableSelectorFields] Error fetching Lakebase tables:",
          err,
        );
        if (active) {
          setTables([]);
          setTableError(
            err instanceof Error
              ? err.message
              : "Failed to fetch Lakebase tables",
          );
        }
      } finally {
        if (active) setLoadingTables(false);
      }
    };

    void fetchTables();
    return () => {
      active = false;
    };
  }, [workspaceConnectionId, selectedCatalog, selectedSchema]);

  const handleInstanceChange = (instanceName: string) => {
    onChange({
      ...value,
      instanceName,
      catalog: selectedCatalog || undefined,
      schema: selectedSchema || undefined,
    });
  };

  const handleCatalogChange = (catalog: string) => {
    setSelectedCatalog(catalog);
    setSelectedSchema("");
    setTables([]);
    onChange({
      ...value,
      catalog: catalog || undefined,
      schema: undefined,
      table: undefined,
      database: undefined,
    });
  };

  const handleSchemaChange = (schema: string) => {
    setSelectedSchema(schema);
    setTables([]);
    onChange({
      ...value,
      catalog: selectedCatalog || undefined,
      schema: schema || undefined,
      table: undefined,
    });
  };

  const handleTableChange = (table: string) => {
    onChange({
      ...value,
      catalog: selectedCatalog || undefined,
      schema: selectedSchema || undefined,
      table: table || undefined,
    });
  };

  const renderStringItems = (
    error: string | null,
    items: string[],
    emptyLabel: string,
  ) => {
    if (error)
      return (
        <SelectItem value="error" disabled>
          {error}
        </SelectItem>
      );
    if (items.length === 0)
      return (
        <SelectItem value="none" disabled>
          {emptyLabel}
        </SelectItem>
      );
    return items.map((item) => (
      <SelectItem key={item} value={item}>
        {item}
      </SelectItem>
    ));
  };

  const instanceField = (
    <div className="space-y-1">
      <Label className="text-sm">Database Instance</Label>
      <Select
        value={value.instanceName || ""}
        onValueChange={handleInstanceChange}
        disabled={loadingInstances || !!instanceError}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loadingInstances ? "Loading instances..." : "Select instance..."
            }
          />
        </SelectTrigger>
        <SelectContent>
          {renderStringItems(instanceError, instances, "No instances found")}
        </SelectContent>
      </Select>
    </div>
  );

  const databaseField = (
    <div className="space-y-1">
      <Label className="text-sm">Database</Label>
      <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">
        {value.database || DATABASE_PLACEHOLDER_TEXT}
      </div>
    </div>
  );

  const catalogField = (
    <div className="space-y-1">
      <Label className="text-sm">Catalog</Label>
      <Select
        value={selectedCatalog}
        onValueChange={handleCatalogChange}
        disabled={loadingCatalogs || !!hierarchyCatalogError}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loadingCatalogs ? "Loading catalogs..." : "Select catalog..."
            }
          />
        </SelectTrigger>
        <SelectContent className="overflow-y-auto max-h-60">
          {renderStringItems(
            hierarchyCatalogError,
            catalogs,
            "No catalogs found",
          )}
        </SelectContent>
      </Select>
    </div>
  );

  const schemaField = (
    <div className="space-y-1">
      <Label className="text-sm">Schema</Label>
      <Select
        value={selectedSchema}
        onValueChange={handleSchemaChange}
        disabled={!selectedCatalog || loadingSchemas || !!hierarchySchemaError}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loadingSchemas ? "Loading schemas..." : "Select schema..."
            }
          />
        </SelectTrigger>
        <SelectContent>
          {!selectedCatalog ? (
            <SelectItem value="no-catalog" disabled>
              Select a catalog first
            </SelectItem>
          ) : (
            renderStringItems(hierarchySchemaError, schemas, "No schemas found")
          )}
        </SelectContent>
      </Select>
    </div>
  );

  const tableField = (
    <div className="space-y-1">
      <Label className="text-sm">Table</Label>
      <Select
        value={value.table || ""}
        onValueChange={handleTableChange}
        disabled={
          !selectedCatalog ||
          !selectedSchema ||
          loadingTables ||
          !!tableError ||
          !!hierarchyCatalogError ||
          !!hierarchySchemaError ||
          tables.length === 0
        }
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loadingTables ? "Loading tables..." : "Select table..."
            }
          />
        </SelectTrigger>
        <SelectContent>
          {tableError || hierarchyCatalogError || hierarchySchemaError ? (
            <SelectItem value="error" disabled>
              {tableError || hierarchyCatalogError || hierarchySchemaError}
            </SelectItem>
          ) : !selectedCatalog || !selectedSchema ? (
            <SelectItem value="missing-parent" disabled>
              Select catalog and schema first
            </SelectItem>
          ) : tables.length === 0 ? (
            <SelectItem value="none" disabled>
              No tables found
            </SelectItem>
          ) : (
            tables.map((tableItem) => (
              <SelectItem key={tableItem.table} value={tableItem.table}>
                {tableItem.table}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );

  if (layoutVariant === "propertyPanel") {
    return (
      <div className="space-y-3">
        {instanceField}
        {databaseField}
        {catalogField}
        {schemaField}
        {tableField}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {instanceField}
        {databaseField}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {catalogField}
        {schemaField}
        {tableField}
      </div>
    </div>
  );
};
