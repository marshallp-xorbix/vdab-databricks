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
  type DatabricksGenieSpaceListItem,
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

interface DatabricksGenieSpaceResourceSelectorEditorProps {
  spaceId?: string;
  /** When the space is not in the workspace list (e.g. loaded from app), used for the extra option label. */
  fallbackName?: string;
  onChange: (next: { spaceId: string; name: string }) => void;
  workspaceConnectionId?: number;
  showFieldLabel?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
}

export const DatabricksGenieSpaceResourceSelectorEditor: FC<
  DatabricksGenieSpaceResourceSelectorEditorProps
> = ({
  spaceId,
  fallbackName,
  onChange,
  workspaceConnectionId,
  showFieldLabel = true,
  onWorkspaceFetchIssue,
}) => {
  const [spaces, setSpaces] = useState<DatabricksGenieSpaceListItem[]>([]);
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
        setSpaces([]);
        setLoading(false);
        return;
      }
      try {
        const data = await databricksDataConnectorApi.getGenieSpaces(
          workspaceConnectionId!,
        );
        setSpaces(data || []);
      } catch (err) {
        setSpaces([]);
        setError(formatApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [workspaceConnectionId, workspaceMissing]);

  const optionRows = useMemo(() => {
    const base = [...spaces];
    const id = spaceId?.trim();
    if (id && !base.some((s) => s.spaceId === id)) {
      const label = fallbackName?.trim() || id;
      base.push({ spaceId: id, name: label });
    }
    return base;
  }, [spaces, spaceId, fallbackName]);

  const rowIssue = workspaceMissing ?? error;
  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  const selectValue = spaceId?.trim() || undefined;
  const blockingMessage = workspaceMissing ?? error;

  return (
    <div className="space-y-1">
      {showFieldLabel ? (
        <Label className={RESOURCE_FIELD_LABEL_CLASS}>Genie space</Label>
      ) : null}
      <Select
        value={selectValue}
        onValueChange={(id) => {
          const row = optionRows.find((s) => s.spaceId === id);
          onChange({
            spaceId: id,
            name: row?.name ?? id,
          });
        }}
        disabled={loading || Boolean(workspaceMissing)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              loading ? "Loading Genie spaces…" : "Select a Genie space"
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
              No Genie spaces found
            </SelectItem>
          ) : (
            optionRows.map((s) => (
              <SelectItem key={s.spaceId} value={s.spaceId}>
                {s.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
