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
  type DatabricksExperimentListItem,
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

interface DatabricksMlflowExperimentSelectorEditorProps {
  value?: string;
  onChange: (experimentId: string) => void;
  workspaceConnectionId?: number;
  showFieldLabel?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
}

export const DatabricksMlflowExperimentSelectorEditor: FC<
  DatabricksMlflowExperimentSelectorEditorProps
> = ({
  value,
  onChange,
  workspaceConnectionId,
  showFieldLabel = true,
  onWorkspaceFetchIssue,
}) => {
  const [experiments, setExperiments] = useState<DatabricksExperimentListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceMissing =
    !workspaceConnectionId || workspaceConnectionId <= 0
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      if (workspaceMissing) {
        setExperiments([]);
        setLoading(false);
        return;
      }
      try {
        const data = await databricksDataConnectorApi.getExperiments(
          workspaceConnectionId!,
        );
        setExperiments(data || []);
      } catch (err) {
        setExperiments([]);
        setError(formatApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [workspaceConnectionId, workspaceMissing]);

  const optionRows = useMemo(() => {
    const base = [...experiments];
    const v = value?.trim();
    if (v && !base.some((e) => e.experimentId === v)) {
      base.push({ experimentId: v, name: v });
    }
    return base;
  }, [experiments, value]);

  const rowIssue = workspaceMissing ?? error;
  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  const selectValue = value?.trim() || undefined;
  const blockingMessage = workspaceMissing ?? error;

  return (
    <div className="space-y-1">
      {showFieldLabel ? (
        <Label className={RESOURCE_FIELD_LABEL_CLASS}>Experiment</Label>
      ) : null}
      <Select
        value={selectValue}
        onValueChange={onChange}
        disabled={loading || Boolean(workspaceMissing)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loading ? "Loading experiments…" : "Select an experiment"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,70vh)]">
          {loading ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : blockingMessage ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {blockingMessage}
            </SelectItem>
          ) : optionRows.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No experiments found
            </SelectItem>
          ) : (
            optionRows.map((e) => (
              <SelectItem key={e.experimentId} value={e.experimentId}>
                {e.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
