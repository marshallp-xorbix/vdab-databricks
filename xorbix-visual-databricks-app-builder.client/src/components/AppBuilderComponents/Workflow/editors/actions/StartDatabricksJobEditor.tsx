import { useEffect, useState, type FC } from "react";
import {
  databricksDataConnectorApi,
  type DatabricksJob,
} from "../../../../../providers/DatabricksDataConnectorApi";
import { Label } from "../../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../ui/select";
import { isWorkflowActionNode } from "../../../../../types/workflow";
import type { WorkflowActionEditorProps } from "./types";
import { useLogger } from "../../../../../logger/useLogger";

export const StartDatabricksJobEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  node,
  workspaceConnectionId,
  onUpdateNode,
}) => {
  const logger = useLogger("StartDatabricksJobEditor");
  const [jobs, setJobs] = useState<DatabricksJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchJobs = async () => {
      if (!workspaceConnectionId || workspaceConnectionId <= 0) {
        if (active) {
          setJobs([]);
          setError("Workspace connection is not set for this workflow.");
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const nextJobs = await databricksDataConnectorApi.getJobs(
          workspaceConnectionId,
        );

        if (active) {
          setJobs(nextJobs ?? []);
        }
      } catch (err) {
        if (active) {
          logger.UI.error(
            "[StartDatabricksJobEditor] Failed to fetch Databricks jobs:",
            err,
          );
          setJobs([]);
          setError(err instanceof Error ? err.message : "Failed to load jobs");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchJobs();

    return () => {
      active = false;
    };
  }, [workspaceConnectionId]);

  if (!isWorkflowActionNode(node, "StartDatabricksJob")) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="space-y-1">
        <Label className="text-sm">Databricks Job</Label>
        <Select
          value={node.params.job.jobId}
          onValueChange={(value) => {
            const selectedJob = jobs.find((job) => job.jobId === value);
            if (!selectedJob) {
              return;
            }

            onUpdateNode(workflowId, node.id, (current) =>
              isWorkflowActionNode(current, "StartDatabricksJob")
                ? {
                    ...current,
                    params: {
                      ...current.params,
                      job: {
                        ...current.params.job,
                        workspaceConnectionId:
                          workspaceConnectionId ??
                          current.params.job.workspaceConnectionId,
                        jobId: selectedJob.jobId,
                        jobName: selectedJob.jobName,
                      },
                    },
                  }
                : current,
            );
          }}
          disabled={loading || jobs.length === 0 || !!error}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue
              placeholder={loading ? "Loading jobs..." : "Select job..."}
            />
          </SelectTrigger>
          <SelectContent>
            {jobs.map((job) => (
              <SelectItem key={job.jobId} value={job.jobId}>
                {job.jobName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {node.params.job.jobName && (
        <p className="text-xs text-muted-foreground">
          Selected job: {node.params.job.jobName} ({node.params.job.jobId})
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && jobs.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">
          No Databricks jobs were returned for this workspace connection.
        </p>
      )}
    </div>
  );
};
