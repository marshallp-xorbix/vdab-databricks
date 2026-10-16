import type { FC } from "react";
import {
  UnityCatalogTableSelectorFields,
  type UnityCatalogTableSelectorValue,
} from "./UnityCatalogTableSelectorFields";

interface DatabricksTableSelectorEditorProps {
  value?: string;
  catalog?: string;
  schema?: string;
  onChange: (catalog: string, schema: string, table: string) => void;
  workspaceConnectionId?: number;
}

/**
 * Databricks Table Selector Editor
 * Selects a Unity Catalog table for actions (no column enrichment).
 */
export const DatabricksTableSelectorEditor: FC<
  DatabricksTableSelectorEditorProps
> = ({ value, catalog, schema, onChange, workspaceConnectionId }) => {
  const selectorValue: UnityCatalogTableSelectorValue = {
    catalog,
    schema,
    table: value,
  };

  return (
    <UnityCatalogTableSelectorFields
      value={selectorValue}
      workspaceConnectionId={workspaceConnectionId}
      tableLabel="Delta Table"
      onChange={(next) => {
        onChange(next.catalog || "", next.schema || "", next.table || "");
      }}
    />
  );
};
