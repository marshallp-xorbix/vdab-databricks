import { useEffect, useMemo, useState, type FC } from "react";
import {
  RESOURCE_FIELD_LABEL_CLASS,
  SELECT_DISABLED,
  WORKSPACE_CONNECTION_MISSING_MESSAGE,
} from "../../constants/databricksAppResourcesUi";
import { useReportWorkspacePickerIssue } from "../../hooks/useReportWorkspacePickerIssue";
import {
  databricksDataConnectorApi,
  type UnityCatalogTable,
} from "../../providers/DatabricksDataConnectorApi";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useUnityCatalogHierarchy } from "./useUnityCatalogHierarchy";

export interface UnityCatalogTableSelectorValue {
  catalog?: string;
  schema?: string;
  table?: string;
}

interface UnityCatalogTableSelectorFieldsProps {
  value: UnityCatalogTableSelectorValue;
  workspaceConnectionId?: number;
  onChange: (next: UnityCatalogTableSelectorValue) => void;
  tableLabel?: string;
  layoutVariant?: "default" | "propertyPanel";
  hideFieldLabels?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
}

export const UnityCatalogTableSelectorFields: FC<
  UnityCatalogTableSelectorFieldsProps
> = ({
  value,
  workspaceConnectionId,
  onChange,
  tableLabel = "Table",
  layoutVariant = "default",
  hideFieldLabels = false,
  onWorkspaceFetchIssue,
}) => {
  const [tables, setTables] = useState<UnityCatalogTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const workspaceMissing =
    !workspaceConnectionId || workspaceConnectionId <= 0
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  const rowIssue = useMemo(
    () =>
      workspaceMissing ??
      hierarchyCatalogError ??
      hierarchySchemaError ??
      error,
    [workspaceMissing, hierarchyCatalogError, hierarchySchemaError, error],
  );

  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  useEffect(() => {
    setSelectedCatalog(value.catalog || "");
  }, [value.catalog]);

  useEffect(() => {
    setSelectedSchema(value.schema || "");
  }, [value.schema]);

  useEffect(() => {
    let active = true;

    const fetchTables = async () => {
      setLoading(true);
      setError(null);

      if (workspaceMissing) {
        if (active) {
          setTables([]);
          setLoading(false);
        }
        return;
      }

      if (!selectedCatalog || !selectedSchema) {
        if (active) {
          setTables([]);
          setLoading(false);
        }
        return;
      }

      try {
        const tablesData =
          await databricksDataConnectorApi.getUnityCatalogTables(
            workspaceConnectionId!,
            selectedCatalog,
            selectedSchema,
          );
        if (active) setTables(tablesData || []);
      } catch (err) {
        if (active) {
          setTables([]);
          setError(formatApiErrorMessage(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchTables();
    return () => {
      active = false;
    };
  }, [workspaceConnectionId, workspaceMissing, selectedCatalog, selectedSchema]);

  const handleCatalogChange = (catalog: string) => {
    setSelectedCatalog(catalog);
    setSelectedSchema("");
    setTables([]);
    onChange({
      catalog: catalog || undefined,
      schema: undefined,
      table: undefined,
    });
  };

  const handleSchemaChange = (schema: string) => {
    setSelectedSchema(schema);
    setTables([]);
    onChange({
      catalog: selectedCatalog || undefined,
      schema: schema || undefined,
      table: undefined,
    });
  };

  const handleTableChange = (table: string) => {
    onChange({
      catalog: selectedCatalog || undefined,
      schema: selectedSchema || undefined,
      table: table || undefined,
    });
  };

  const labelCls = hideFieldLabels ? "sr-only" : RESOURCE_FIELD_LABEL_CLASS;

  const catalogBlocking = workspaceMissing ?? hierarchyCatalogError;
  const tableBlocking =
    workspaceMissing ??
    error ??
    hierarchyCatalogError ??
    hierarchySchemaError;

  const catalogField = (
    <div className="min-w-0 space-y-1">
      <Label className={labelCls}>Catalog</Label>
      <Select
        value={selectedCatalog || undefined}
        onValueChange={handleCatalogChange}
        disabled={loadingCatalogs || Boolean(workspaceMissing)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loadingCatalogs ? "Loading catalogs…" : "Select a catalog"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-60 overflow-y-auto">
          {loadingCatalogs ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : catalogBlocking ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {catalogBlocking}
            </SelectItem>
          ) : catalogs.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No catalogs found
            </SelectItem>
          ) : (
            catalogs.map((catalogName) => (
              <SelectItem key={catalogName} value={catalogName}>
                {catalogName}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );

  const schemaField = (
    <div className="min-w-0 space-y-1">
      <Label className={labelCls}>Schema</Label>
      <Select
        value={selectedSchema || undefined}
        onValueChange={handleSchemaChange}
        disabled={!selectedCatalog || loadingSchemas || Boolean(workspaceMissing)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loadingSchemas ? "Loading schemas…" : "Select a schema"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {loadingSchemas ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : workspaceMissing ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {workspaceMissing}
            </SelectItem>
          ) : hierarchySchemaError ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {hierarchySchemaError}
            </SelectItem>
          ) : !selectedCatalog ? (
            <SelectItem value={SELECT_DISABLED.chooseCatalogFirst} disabled>
              Select a catalog first
            </SelectItem>
          ) : schemas.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No schemas found
            </SelectItem>
          ) : (
            schemas.map((schemaName) => (
              <SelectItem key={schemaName} value={schemaName}>
                {schemaName}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );

  const tableField = (
    <div className="min-w-0 space-y-1">
      <Label className={labelCls}>{tableLabel}</Label>
      <Select
        value={value.table || undefined}
        onValueChange={handleTableChange}
        disabled={
          !selectedCatalog ||
          !selectedSchema ||
          loading ||
          Boolean(workspaceMissing)
        }
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={loading ? "Loading tables…" : "Select a table"}
          />
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : tableBlocking ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {tableBlocking}
            </SelectItem>
          ) : !selectedCatalog || !selectedSchema ? (
            <SelectItem value={SELECT_DISABLED.chooseParentsFirst} disabled>
              Select catalog and schema first
            </SelectItem>
          ) : tables.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
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

  return (
    <div
      className={
        layoutVariant === "propertyPanel"
          ? "space-y-3"
          : hideFieldLabels
            ? "grid min-w-0 grid-cols-3 gap-1.5"
            : "grid gap-3 md:grid-cols-3"
      }
    >
      {catalogField}
      {schemaField}
      {tableField}
    </div>
  );
};
