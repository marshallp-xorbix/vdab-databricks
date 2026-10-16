import type { FC } from "react";
import {
  databricksDataConnectorApi,
  type UnityCatalogTableDetails,
} from "../../providers/DatabricksDataConnectorApi";
import type {
  Binding,
  ResourceBindingSource,
} from "../../types/components/bindings";
import {
  UnityCatalogTableSelectorFields,
  type UnityCatalogTableSelectorValue,
} from "./UnityCatalogTableSelectorFields";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { UnityCatalogColumn } from "../../types/components/bindings";
import { useLogger } from "../../logger/useLogger";

interface UnityCatalogTableConfig {
  type?: string;
  catalog?: string;
  schema?: string;
  table?: string;
  columns?: UnityCatalogColumn[];
  primaryKeyColumn?: string;
}

interface UnityCatalogTableSelectorEditorProps {
  binding: Binding;
  onChange: (binding: Binding) => void;
  workspaceConnectionId?: number;
}

/**
 * Unity Catalog Table Selector Editor
 * Edits a UnityCatalogTable binding config and enriches selected table columns.
 */
export const UnityCatalogTableSelectorEditor: FC<
  UnityCatalogTableSelectorEditorProps
> = ({ binding, onChange, workspaceConnectionId }) => {
  const logger = useLogger("UnityCatalogTableSelectorEditor");
  const config: ResourceBindingSource =
    binding.source.resource || ({} as ResourceBindingSource);
  const currentCatalog = config.catalog;
  const currentSchema = config.schema;
  const currentTable = config.table;

  const selectorValue: UnityCatalogTableSelectorValue = {
    catalog: currentCatalog,
    schema: currentSchema,
    table: currentTable,
  };
  const selectedPrimaryKeyColumn = config.primaryKeyColumn;
  const columns = (config.columns as UnityCatalogColumn[] | undefined) ?? [];
  const columnNames = columns
    .map((column) => column.name)
    .filter((name): name is string => Boolean(name && name.length > 0));

  const updateConfig = (updates: Partial<UnityCatalogTableConfig>) => {
    onChange({
      ...binding,
      source: {
        ...binding.source,
        kind: "resource",
        valueType: "table",
        resource: {
          ...config,
          type: "unityCatalogTable",
          ...updates,
        },
      },
    });
  };

  const handleSelectionChange = async (
    next: UnityCatalogTableSelectorValue,
  ) => {
    const catalogChanged = next.catalog !== currentCatalog;
    const schemaChanged = next.schema !== currentSchema;
    const tableChanged = next.table !== currentTable;

    if (!next.table) {
      updateConfig({
        catalog: next.catalog,
        schema: next.schema,
        table: undefined,
        columns: undefined,
        primaryKeyColumn: undefined,
      });
      return;
    }

    if (
      !workspaceConnectionId ||
      workspaceConnectionId <= 0 ||
      !next.catalog ||
      !next.schema
    ) {
      updateConfig({
        catalog: next.catalog,
        schema: next.schema,
        table: next.table,
      });
      return;
    }

    if (!catalogChanged && !schemaChanged && !tableChanged) {
      updateConfig({
        catalog: next.catalog,
        schema: next.schema,
        table: next.table,
      });
      return;
    }

    let tableDetails: UnityCatalogTableDetails | null = null;
    try {
      tableDetails =
        await databricksDataConnectorApi.getUnityCatalogTableDetails(
          workspaceConnectionId,
          next.catalog,
          next.schema,
          next.table,
        );
    } catch (err) {
      logger.UI.error(
        "[UnityCatalogTableSelectorEditor] Error fetching table details:",
        err,
      );
    }

    updateConfig({
      catalog: next.catalog,
      schema: next.schema,
      table: next.table,
      columns: tableDetails?.columns || [],
      primaryKeyColumn: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <UnityCatalogTableSelectorFields
        value={selectorValue}
        workspaceConnectionId={workspaceConnectionId}
        layoutVariant="propertyPanel"
        onChange={(next) => {
          void handleSelectionChange(next);
        }}
      />
      {columnNames.length > 0 && (
        <div className="space-y-2">
          <Label>Primary Key Column</Label>
          <Select
            value={selectedPrimaryKeyColumn ?? "__none"}
            onValueChange={(nextValue) => {
              updateConfig({
                primaryKeyColumn:
                  nextValue === "__none" ? undefined : nextValue,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select primary key column" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None</SelectItem>
              {columnNames.map((columnName) => (
                <SelectItem key={columnName} value={columnName}>
                  {columnName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
