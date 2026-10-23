import { useState } from "react";
import { Button } from "./ui/button";
import { useProjectDeployment } from "../hooks/useProjectDeployments";
import { useRetryProjectDeployment } from "../hooks/useRetryProjectDeployment";
import { useRollbackProjectDeployment } from "../hooks/useRollbackProjectDeployment";
import type { IProjectDeploymentSummary } from "../models/ProjectDeployments";

interface IProjectDeploymentHistoryItemProps {
  projectId: string;
  deployment: IProjectDeploymentSummary;
  canEdit: boolean | undefined;
  canRestore: boolean;
}

type RecoveryOperation = "retry" | "rollback";

/** Displays one deployment state and confirms destructive recovery actions. */
function ProjectDeploymentHistoryItem({
  projectId,
  deployment,
  canEdit,
  canRestore,
}: Readonly<IProjectDeploymentHistoryItemProps>) {
  const deploymentQuery = useProjectDeployment(projectId, deployment);
  const retryMutation = useRetryProjectDeployment();
  const rollbackMutation = useRollbackProjectDeployment();
  const [confirmation, setConfirmation] = useState<RecoveryOperation | null>(null);
  const currentDeployment = deploymentQuery.data ?? deployment;
  const isMutationPending = retryMutation.isPending || rollbackMutation.isPending;

  async function handleRecovery() {
    if (!confirmation) return;
    const input = { projectId, deploymentId: currentDeployment.id };
    try {
      if (confirmation === "retry") await retryMutation.mutateAsync(input);
      else await rollbackMutation.mutateAsync(input);
      setConfirmation(null);
    } catch {
      // The mutation error below provides a sanitized explanation.
    }
  }

  return (
    <li className="space-y-2 rounded-lg border border-border p-4">
      <p className="font-medium">{currentDeployment.status} · version {currentDeployment.sourceVersion}</p>
      <p className="break-all text-sm text-muted-foreground">Deployment record: {currentDeployment.id}</p>
      <p className="break-all text-sm text-muted-foreground">Databricks deployment: {currentDeployment.deploymentId ?? "not submitted"}</p>
      {currentDeployment.failureCode && <p role="alert" className="text-sm">Failure: {currentDeployment.failureCode}</p>}
      {deploymentQuery.isError && <p role="alert" className="text-sm">{deploymentQuery.error instanceof Error ? deploymentQuery.error.message : "Deployment status could not be refreshed."}</p>}
      <p className="text-xs text-muted-foreground">Started {new Date(currentDeployment.createdAt).toLocaleString()}</p>
      <div className="flex flex-wrap gap-2">
        {(currentDeployment.status === "failed" || currentDeployment.status === "cancelled") && canEdit && (
          <Button type="button" variant="outline" disabled={isMutationPending} onClick={() => setConfirmation("retry")}>Retry saved source</Button>
        )}
        {canRestore && canEdit && (
          <Button type="button" variant="outline" disabled={isMutationPending} onClick={() => setConfirmation("rollback")}>Restore last successful source</Button>
        )}
      </div>
      {confirmation && (
        <div role="group" aria-labelledby={`recovery-heading-${currentDeployment.id}`} className="space-y-3 rounded-md border border-destructive/50 p-3">
          <h3 id={`recovery-heading-${currentDeployment.id}`} className="font-medium">Confirm {confirmation}</h3>
          <p className="text-sm">This will replace App <strong>{currentDeployment.appName}</strong> source using its saved immutable snapshot.</p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" disabled={isMutationPending} onClick={() => void handleRecovery()}>
              {isMutationPending ? "Submitting…" : `Confirm ${confirmation}`}
            </Button>
            <Button type="button" variant="outline" disabled={isMutationPending} onClick={() => setConfirmation(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {(retryMutation.isError || rollbackMutation.isError) && (
        <p role="alert">{retryMutation.error instanceof Error ? retryMutation.error.message : rollbackMutation.error instanceof Error ? rollbackMutation.error.message : "Recovery operation could not be completed."}</p>
      )}
    </li>
  );
}

export default ProjectDeploymentHistoryItem;
