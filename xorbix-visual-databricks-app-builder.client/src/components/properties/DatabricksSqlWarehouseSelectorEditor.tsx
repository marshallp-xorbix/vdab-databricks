import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  RESOURCE_FIELD_LABEL_CLASS,
  SELECT_DISABLED,
  WORKSPACE_CONNECTION_MISSING_MESSAGE,
} from "../../constants/databricksAppResourcesUi";
import { useReportWorkspacePickerIssue } from "../../hooks/useReportWorkspacePickerIssue";
import {
  databricksDataConnectorApi,
  type DatabricksSqlWarehouse,
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

interface DatabricksSqlWarehouseSelectorEditorProps {
  value?: string;
  onChange: (warehouseId: string) => void;
  workspaceConnectionId?: number;
  showFieldLabel?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
}

/**
 * Loads SQL warehouses from the workspace for Databricks app resource binding.
 */
export const DatabricksSqlWarehouseSelectorEditor: FC<
  DatabricksSqlWarehouseSelectorEditorProps
> = ({
  value,
  onChange,
  workspaceConnectionId,
  showFieldLabel = true,
  onWorkspaceFetchIssue,
}) => {
  const [warehouses, setWarehouses] = useState<DatabricksSqlWarehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceMissing =
    !workspaceConnectionId || workspaceConnectionId <= 0
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  useEffect(() => {
    const fetchWarehouses = async () => {
      setLoading(true);
      setError(null);

      if (workspaceMissing) {
        setWarehouses([]);
        setLoading(false);
        return;
      }

      try {
        const data = await databricksDataConnectorApi.getSqlWarehouses(
          workspaceConnectionId!,
        );
        setWarehouses(data || []);
      } catch (err) {
        setWarehouses([]);
        setError(formatApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    void fetchWarehouses();
  }, [workspaceConnectionId, workspaceMissing]);

  const rows = useMemo(() => {
    const list = [...warehouses];
    const id = value?.trim();
    if (id && !list.some((w) => w.warehouseId === id)) {
      list.push({ warehouseId: id, name: id });
    }
    return list;
  }, [warehouses, value]);

  const rowIssue = workspaceMissing ?? error;
  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  const selectValue = value?.trim() || undefined;
  const blockingMessage = workspaceMissing ?? error;

  return (
    <div className="space-y-1">
      {showFieldLabel ? (
        <Label className={RESOURCE_FIELD_LABEL_CLASS}>SQL warehouse</Label>
      ) : null}
      <Select
        value={selectValue}
        onValueChange={onChange}
        disabled={loading || Boolean(workspaceMissing)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loading ? "Loading warehouses…" : "Select a SQL warehouse"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : blockingMessage ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {blockingMessage}
            </SelectItem>
          ) : rows.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No warehouses found
            </SelectItem>
          ) : (
            rows.map((w) => (
              <SelectItem key={w.warehouseId} value={w.warehouseId}>
                {w.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
