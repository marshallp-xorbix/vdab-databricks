import { useState } from "react";
import { Button } from "./ui/button";
import { useProjectCollaborators } from "../hooks/useProjectCollaborators";
import { useRevokeProjectCollaborator } from "../hooks/useRevokeProjectCollaborator";

interface IProjectCollaboratorsEditorProps {
  projectId: string;
  canManageCollaborators: boolean;
}

/** Lets a project owner review and revoke VDAB-only editor grants. */
function ProjectCollaboratorsEditor({
  projectId,
  canManageCollaborators,
}: Readonly<IProjectCollaboratorsEditorProps>) {
  const collaboratorsQuery = useProjectCollaborators(projectId);
  const revokeMutation = useRevokeProjectCollaborator();
  const [pendingRemovalUserId, setPendingRemovalUserId] = useState<string | null>(null);

  async function handleConfirmRemoval(userId: string) {
    try {
      await revokeMutation.mutateAsync({ projectId, userId });
      setPendingRemovalUserId(null);
    } catch {
      // The mutation state renders the sanitized API error.
    }
  }

  return (
    <section aria-labelledby="project-collaborators-heading" className="space-y-4">
      <div>
        <h2 id="project-collaborators-heading" className="text-lg font-semibold">
          Who can edit
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Project access applies inside VDAB. Databricks resource permissions are checked separately.
        </p>
      </div>

      {collaboratorsQuery.isPending && (
        <p role="status" aria-live="polite">Loading project access…</p>
      )}
      {collaboratorsQuery.isError && (
        <div className="grid gap-2" role="alert">
          <p>
            {collaboratorsQuery.error instanceof Error
              ? collaboratorsQuery.error.message
              : "Project access could not be loaded."}
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void collaboratorsQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      {collaboratorsQuery.data?.length === 0 && (
        <p className="text-sm">No collaborators have editor access to this project.</p>
      )}
      {collaboratorsQuery.data && collaboratorsQuery.data.length > 0 && (
        <ul className="divide-y divide-border">
          {collaboratorsQuery.data.map((collaborator) => (
            <li key={collaborator.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{collaborator.userId}</p>
                <p className="text-sm text-muted-foreground">
                  Editor · added {new Date(collaborator.createdAt).toLocaleString()}
                </p>
              </div>
              {pendingRemovalUserId === collaborator.userId ? (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm removal of ${collaborator.userId}`}>
                  <span className="text-sm">Remove this person’s project access?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={revokeMutation.isPending}
                    onClick={() => void handleConfirmRemoval(collaborator.userId)}
                  >
                    {revokeMutation.isPending ? "Removing…" : "Confirm removal"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={revokeMutation.isPending}
                    onClick={() => setPendingRemovalUserId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={revokeMutation.isPending}
                  aria-label={`Remove access for ${collaborator.userId}`}
                  onClick={() => {
                    revokeMutation.reset();
                    setPendingRemovalUserId(collaborator.userId);
                  }}
                >
                  Remove access
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {revokeMutation.isError && (
        <p role="alert">
          {revokeMutation.error instanceof Error
            ? revokeMutation.error.message
            : "Project access could not be removed."}
        </p>
      )}
      {canManageCollaborators && (
        <p className="text-sm text-muted-foreground">
          The workspace directory picker is unavailable because Databricks Apps does not support the SCIM scope required to search users.
        </p>
      )}
    </section>
  );
}

export default ProjectCollaboratorsEditor;
