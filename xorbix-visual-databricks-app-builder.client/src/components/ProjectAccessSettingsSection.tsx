import { useWorkspaceSession } from "../hooks/useWorkspaceSession";
import SettingsCard from "./AppBuilderComponents/AppSettingsTab/SettingsCard";
import ProjectCollaboratorsEditor from "./ProjectCollaboratorsEditor";

interface IProjectAccessSettingsSectionProps {
  projectId: string;
  projectOwnerUserId: string;
  canManageCollaborators: boolean;
}

/** Presents the project owner and VDAB-only editor grants in the SaaS settings layout. */
function ProjectAccessSettingsSection({
  projectId,
  projectOwnerUserId,
  canManageCollaborators,
}: Readonly<IProjectAccessSettingsSectionProps>) {
  const workspaceSessionQuery = useWorkspaceSession();
  const workspaceSession = workspaceSessionQuery.data;
  const ownerLabel =
    workspaceSession?.userId === projectOwnerUserId && workspaceSession.email
      ? workspaceSession.email
      : projectOwnerUserId;

  return (
    <SettingsCard title="Permissions" className="min-w-0">
      <section aria-label="Project permissions" className="grid gap-6 md:grid-cols-2">
        <article className="min-w-0 rounded-xl bg-muted p-6 shadow-sm">
          <h2 className="text-base font-medium text-foreground">Owner</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The owner manages access within this VDAB installation.
          </p>
          <div className="mt-4 rounded-md bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Workspace user</p>
            <p className="mt-1 truncate text-sm font-medium" title={projectOwnerUserId}>
              {ownerLabel}
            </p>
          </div>
        </article>

        <article className="min-w-0 rounded-xl bg-muted p-6 shadow-sm">
          {canManageCollaborators ? (
            <ProjectCollaboratorsEditor
              projectId={projectId}
              canManageCollaborators={canManageCollaborators}
            />
          ) : (
            <div>
              <h2 className="text-base font-medium text-foreground">Who can edit</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Project access is managed by the owner or an installation administrator.
              </p>
            </div>
          )}
        </article>
      </section>
    </SettingsCard>
  );
}

export default ProjectAccessSettingsSection;
