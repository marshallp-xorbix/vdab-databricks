import type { SaveTargetTableRef } from "../types/workflow/sharedReferences";
import InstalledWorkspaceLakebaseTableSelectorFields from "./InstalledWorkspaceLakebaseTableSelectorFields";
import InstalledWorkspaceUnityCatalogTableSelectorFields from "./InstalledWorkspaceUnityCatalogTableSelectorFields";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const STANDALONE_WORKSPACE_CONNECTION_ID = 0;

interface WorkflowSaveToTableTargetSelectorProps {
  value: SaveTargetTableRef;
  onChange: (next: SaveTargetTableRef) => void;
}

/** Selects a target resource in the workspace hosting the standalone builder. */
export default function WorkflowSaveToTableTargetSelector({
  value,
  onChange,
}: Readonly<WorkflowSaveToTableTargetSelectorProps>) {
  function updateTableType(tableType: string) {
    const workspaceConnectionId = STANDALONE_WORKSPACE_CONNECTION_ID;
    if (tableType === "lakebaseAutoscaling") {
      onChange({
        tableType,
        workspaceConnectionId,
        projectId: "",
        branchId: "",
        endpointId: "",
        database: "",
        catalog: "",
        schema: "",
        table: "",
      });
    } else if (tableType === "unityCatalogTable") {
      onChange({
        tableType,
        workspaceConnectionId,
        catalog: "",
        schema: "",
        table: "",
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="max-w-xs space-y-1">
        <Label className="text-sm font-medium">Target Type</Label>
        <Select
          value={value.tableType}
          onValueChange={updateTableType}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unityCatalogTable">Unity Catalog</SelectItem>
            <SelectItem value="lakebaseAutoscaling">Lakebase Autoscaling</SelectItem>
            {value.tableType === "lakebaseProvisionedDatabase" && (
              <SelectItem value="lakebaseProvisionedDatabase" disabled>
                Legacy Lakebase (reselect target)
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {value.tableType === "unityCatalogTable" && (
        <InstalledWorkspaceUnityCatalogTableSelectorFields
          value={{ catalog: value.catalog, schema: value.schema, table: value.table }}
          onChange={(next) => onChange({ ...value, ...next, workspaceConnectionId: STANDALONE_WORKSPACE_CONNECTION_ID })}
        />
      )}
      {value.tableType === "lakebaseAutoscaling" && (
        <InstalledWorkspaceLakebaseTableSelectorFields value={value} onChange={onChange} />
      )}
      {value.tableType === "lakebaseProvisionedDatabase" && (
        <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-foreground">
          This legacy binding uses a retired external workspace connection. Select Unity Catalog or Lakebase Autoscaling, then choose a target in this workspace.
        </p>
      )}
    </div>
  );
}
