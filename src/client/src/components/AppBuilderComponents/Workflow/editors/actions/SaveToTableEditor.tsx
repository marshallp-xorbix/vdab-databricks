import { useEffect, type FC } from "react";
import {
  isWorkflowActionNode,
  type SaveToTableParams,
  type SaveToTableColumnOverrideReason,
} from "../../../../../types/workflow";
import {
  getSaveToTableSourceComponentOptions,
  getWorkflowTriggerComponent,
  isWorkflowTriggerForm,
} from "../../../../../utils/workflow/actionReferenceOptions";
import WorkflowSaveToTableTargetSelector from "../../../../WorkflowSaveToTableTargetSelector";
import SaveToTableColumnMappingEditor from "./SaveToTableColumnMappingEditor";
import { Label } from "../../../../ui/label";
import type { WorkflowActionEditorProps } from "./types";
import { useWorkspaceTables } from "../../../../../hooks/useWorkspaceTables";
import { useWorkspaceLakebaseTables } from "../../../../../hooks/useWorkspaceLakebaseTables";
import { useWorkspaceLakebaseProvisionedTables } from "../../../../../hooks/useWorkspaceLakebaseProvisionedTables";

export const SaveToTableEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  workflow,
  node,
  components,
  onUpdateNode,
}) => {
  const triggerComponent = getWorkflowTriggerComponent(workflow, components);
  const triggerIsForm = isWorkflowTriggerForm(workflow, components);
  const sourceOptions = getSaveToTableSourceComponentOptions(
    workflow,
    components,
  );
  const isSaveToTableNode = isWorkflowActionNode(node, "SaveToTable");
  const saveToTableParams = isSaveToTableNode ? node.params : null;
  const sourceFormComponentCodeName =
    saveToTableParams?.sourceFormComponentCodeName;
  const targetTableType = saveToTableParams?.targetTable.tableType;
  const targetCatalog = saveToTableParams?.targetTable.catalog;
  const targetSchema = saveToTableParams?.targetTable.schema;
  const targetTableName = saveToTableParams?.targetTable.table;
  const unityCatalogTablesQuery = useWorkspaceTables(
    targetTableType === "unityCatalogTable" ? targetCatalog : null,
    targetTableType === "unityCatalogTable" ? targetSchema : null,
  );
  const lakebaseSelection = saveToTableParams?.targetTable.tableType === "lakebaseAutoscaling" &&
      hasResolvedLakebaseSelection(saveToTableParams.targetTable.projectId) &&
      hasResolvedLakebaseSelection(saveToTableParams.targetTable.branchId) &&
      hasResolvedLakebaseSelection(saveToTableParams.targetTable.endpointId) &&
      hasResolvedLakebaseSelection(saveToTableParams.targetTable.database)
    ? {
        projectId: saveToTableParams.targetTable.projectId,
        branchId: saveToTableParams.targetTable.branchId,
        endpointId: saveToTableParams.targetTable.endpointId,
        databaseName: saveToTableParams.targetTable.database,
      }
    : null;
  const lakebaseTablesQuery = useWorkspaceLakebaseTables(
    lakebaseSelection,
    targetTableType === "lakebaseAutoscaling" ? targetSchema : null,
  );
  const provisionedLakebaseSelection = saveToTableParams?.targetTable.tableType === "lakebaseProvisionedDatabase" &&
      hasResolvedLakebaseSelection(saveToTableParams.targetTable.instanceName) &&
      hasResolvedLakebaseSelection(saveToTableParams.targetTable.database)
    ? {
        instanceName: saveToTableParams.targetTable.instanceName,
        databaseName: saveToTableParams.targetTable.database,
      }
    : null;
  const provisionedLakebaseTablesQuery = useWorkspaceLakebaseProvisionedTables(
    provisionedLakebaseSelection,
    targetTableType === "lakebaseProvisionedDatabase" ? targetSchema : null,
  );

  useEffect(() => {
    if (!triggerIsForm || !triggerComponent?.codeName) {
      return;
    }

    if (!isSaveToTableNode) {
      return;
    }

    const needsSourceSync =
      sourceFormComponentCodeName !== triggerComponent.codeName;
    if (!needsSourceSync) {
      return;
    }

    onUpdateNode(workflowId, node.id, (current) =>
      isWorkflowActionNode(current, "SaveToTable")
        ? {
            ...current,
            params: {
              ...current.params,
              sourceFormComponentCodeName: triggerComponent.codeName,
            },
          }
        : current,
    );
  }, [
    onUpdateNode,
    node.id,
    sourceFormComponentCodeName,
    triggerComponent,
    triggerIsForm,
    isSaveToTableNode,
    workflowId,
  ]);

  if (!saveToTableParams) {
    return null;
  }

  const targetTable = saveToTableParams.targetTable;
  const selectedUnityCatalogTable = unityCatalogTablesQuery.data?.items.find(
    (table) => table.name === targetTableName,
  );
  const selectedLakebaseTable = lakebaseTablesQuery.data?.items.find(
    (table) => table.name === targetTableName,
  );
  const selectedProvisionedLakebaseTable = provisionedLakebaseTablesQuery.data?.items.find(
    (table) => table.name === targetTableName,
  );
  const selectedTableColumns = targetTableType === "lakebaseAutoscaling"
    ? selectedLakebaseTable?.columns
    : targetTableType === "lakebaseProvisionedDatabase"
    ? selectedProvisionedLakebaseTable?.columns
    : targetTableType === "unityCatalogTable"
    ? selectedUnityCatalogTable?.columns
    : undefined;
  const targetColumns = (selectedTableColumns ?? []).map((column) => ({
    name: column.name,
    type: column.type,
    nullable: "nullable" in column ? column.nullable : undefined,
  }));
  const loadingColumns = targetTableType === "lakebaseAutoscaling"
    ? lakebaseTablesQuery.isPending
    : targetTableType === "lakebaseProvisionedDatabase"
    ? provisionedLakebaseTablesQuery.isPending
    : targetTableType === "unityCatalogTable" && unityCatalogTablesQuery.isPending;
  const tableDetailsError = targetTableType === "lakebaseAutoscaling"
    ? lakebaseTablesQuery.error?.message ?? null
    : targetTableType === "lakebaseProvisionedDatabase"
    ? provisionedLakebaseTablesQuery.error?.message ?? null
    : unityCatalogTablesQuery.error?.message ?? null;

  const updateTargetTable = (
    updater: (
      current: SaveToTableParams["targetTable"],
    ) => SaveToTableParams["targetTable"],
  ) => {
    onUpdateNode(workflowId, node.id, (current) =>
      isWorkflowActionNode(current, "SaveToTable")
        ? {
            ...current,
            params: {
              ...current.params,
              targetTable: updater(current.params.targetTable),
            },
          }
        : current,
    );
  };

  const updateColumnMode = (
    columnName: string,
    mode: SaveToTableColumnOverrideReason | null,
  ) => {
    onUpdateNode(workflowId, node.id, (current) => {
      if (!isWorkflowActionNode(current, "SaveToTable")) {
        return current;
      }

      const nextMappings = current.params.columnMappings.filter(
        (mapping) => mapping.targetColumnName !== columnName,
      );
      const nextExcludedColumns = current.params.excludedColumns.filter(
        (column) => column.columnName !== columnName,
      );

      return {
        ...current,
        params: {
          ...current.params,
          columnMappings: nextMappings,
          excludedColumns:
            mode === null
              ? nextExcludedColumns
              : [
                  ...nextExcludedColumns,
                  {
                    columnName,
                    reason: mode,
                  },
                ],
        },
      };
    });
  };

  const updateColumnMapping = (
    columnName: string,
    formChildComponentCodeName: string,
  ) => {
    onUpdateNode(workflowId, node.id, (current) => {
      if (!isWorkflowActionNode(current, "SaveToTable")) {
        return current;
      }

      const nextExcludedColumns = current.params.excludedColumns.filter(
        (column) => column.columnName !== columnName,
      );
      const nextMappings = current.params.columnMappings.filter(
        (mapping) => mapping.targetColumnName !== columnName,
      );

      return {
        ...current,
        params: {
          ...current.params,
          excludedColumns: nextExcludedColumns,
          columnMappings:
            formChildComponentCodeName === ""
              ? nextMappings
              : [
                  ...nextMappings,
                  {
                    targetColumnName: columnName,
                    formChildComponentCodeName,
                  },
                ],
        },
      };
    });
  };

  if (!triggerIsForm || !triggerComponent?.codeName) {
    return (
      <div className="mt-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning-foreground">
        SaveToTable is only available when the workflow trigger component is a
        form.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      <div className="rounded-md border border-border p-3 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-sm">Source Form</Label>
            <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-foreground">
              {triggerComponent.codeName}
            </div>
            <p className="text-xs text-muted-foreground">
              SaveToTable always uses the workflow trigger form as its source.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Available Fields</Label>
            {sourceOptions.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                No supported form field descendants were found under the trigger
                form.
              </p>
            ) : (
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {sourceOptions.map((option) => option.label).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border p-3 space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_1fr] lg:items-start">
          <WorkflowSaveToTableTargetSelector
            value={targetTable}
            onChange={(next) => updateTargetTable(() => next)}
          />
        </div>
      </div>

      <SaveToTableColumnMappingEditor
        params={saveToTableParams}
        columns={targetColumns}
        sourceOptions={sourceOptions}
        isLoading={loadingColumns}
        errorMessage={tableDetailsError}
        onColumnModeChange={updateColumnMode}
        onColumnMappingChange={updateColumnMapping}
      />
    </div>
  );
};

function hasResolvedLakebaseSelection(value: string): boolean {
  return value.length > 0 && !value.startsWith("unresolved_resource_");
}
