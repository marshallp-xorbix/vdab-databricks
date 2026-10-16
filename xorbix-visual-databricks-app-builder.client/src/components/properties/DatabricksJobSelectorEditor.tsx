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
  type DatabricksJob,
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

interface DatabricksJobSelectorEditorProps {
  value?: string;
  onChange: (jobId: string) => void;
  workspaceConnectionId?: number;
  showFieldLabel?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
}

export const DatabricksJobSelectorEditor: FC<
  DatabricksJobSelectorEditorProps
> = ({
  value,
  onChange,
  workspaceConnectionId,
  showFieldLabel = true,
  onWorkspaceFetchIssue,
}) => {
  const [jobs, setJobs] = useState<DatabricksJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceMissing =
    !workspaceConnectionId || workspaceConnectionId <= 0
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      setError(null);

      if (workspaceMissing) {
        setJobs([]);
        setLoading(false);
        return;
      }

      try {
        const jobsData = await databricksDataConnectorApi.getJobs(
          workspaceConnectionId!,
        );
        setJobs(jobsData || []);
      } catch (err) {
        setJobs([]);
        setError(formatApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    void fetchJobs();
  }, [workspaceConnectionId, workspaceMissing]);

  const rows = useMemo(() => {
    const list = [...jobs];
    const id = value?.trim();
    if (id && !list.some((j) => j.jobId === id)) {
      list.push({ jobId: id, jobName: id });
    }
    return list;
  }, [jobs, value]);

  const rowIssue = workspaceMissing ?? error;
  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  const selectValue = value?.trim() || undefined;
  const blockingMessage = workspaceMissing ?? error;

  return (
    <div className="space-y-1">
      {showFieldLabel ? (
        <Label className={RESOURCE_FIELD_LABEL_CLASS}>Job</Label>
      ) : null}
      <Select
        value={selectValue}
        onValueChange={onChange}
        disabled={loading || Boolean(workspaceMissing)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={loading ? "Loading jobs…" : "Select a job"}
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
          ) : rows.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No jobs found
            </SelectItem>
          ) : (
            rows.map((job) => (
              <SelectItem key={job.jobId} value={job.jobId}>
                {job.jobName}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
