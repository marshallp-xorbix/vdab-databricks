import type { FC } from "react";
import {
  LakebaseTableSelectorFields,
  type LakebaseSelectorValue,
} from "./LakebaseTableSelectorFields";

interface LakebaseTableSelectorEditorProps {
  instanceName?: string;
  catalog?: string;
  schema?: string;
  database?: string;
  table?: string;
  onChange: (params: {
    instanceName?: string;
    catalog?: string;
    schema?: string;
    table?: string;
    database?: string;
  }) => void;
  workspaceConnectionId?: number;
}

/**
 * Lakebase Table Selector Editor (for SaveToTable action)
 */
export const LakebaseTableSelectorEditor: FC<
  LakebaseTableSelectorEditorProps
> = ({
  instanceName,
  catalog,
  schema,
  database,
  table,
  onChange,
  workspaceConnectionId,
}) => {
  const value: LakebaseSelectorValue = {
    instanceName,
    catalog,
    schema,
    database,
    table,
  };

  return (
    <LakebaseTableSelectorFields
      value={value}
      workspaceConnectionId={workspaceConnectionId}
      onChange={(next) => {
        onChange({
          instanceName: next.instanceName,
          catalog: next.catalog,
          schema: next.schema,
          table: next.table,
          database: next.database,
        });
      }}
    />
  );
};
