import { Label } from "../../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../ui/select";
import { isWorkflowActionNode } from "../../../../../types/workflow";
import type { WorkflowNode } from "../../../../../types/workflow";
import type { WorkflowActionEditorProps } from "./types";
import { useWorkspaceJobs } from "../../../../../hooks/useWorkspaceJobs";

interface IStartDatabricksJobEditorProps {
  workflowId: string;
  node: WorkflowNode;
  onUpdateNode: WorkflowActionEditorProps["onUpdateNode"];
}

function StartDatabricksJobEditor({
  workflowId,
  node,
  onUpdateNode,
}: Readonly<IStartDatabricksJobEditorProps>) {
  const jobsQuery = useWorkspaceJobs();
  const jobs = jobsQuery.data?.items ?? [];

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
                        jobId: selectedJob.jobId,
                        jobName: selectedJob.name,
                      },
                    },
                  }
                : current,
            );
          }}
          disabled={jobsQuery.isPending || jobs.length === 0 || jobsQuery.isError}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue
              placeholder={jobsQuery.isPending ? "Loading jobs…" : "Select job…"}
            />
          </SelectTrigger>
          <SelectContent>
            {jobs.map((job) => (
              <SelectItem key={job.jobId} value={job.jobId}>
                {job.name}
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

      <p className="text-xs text-muted-foreground">
        Databricks checks your permission to start the job. The job itself runs as its configured Run as identity.
      </p>

      {jobsQuery.isError && (
        <p className="text-xs text-destructive" role="alert">
          {jobsQuery.error instanceof Error
            ? jobsQuery.error.message
            : "Jobs could not be loaded with your current workspace permissions."}
        </p>
      )}
      {!jobsQuery.isError && jobs.length === 0 && !jobsQuery.isPending && (
        <p className="text-xs text-muted-foreground">
          No Databricks Jobs are visible to your user in the workspace hosting VDAB.
        </p>
      )}
    </div>
  );
}

export default StartDatabricksJobEditor;
