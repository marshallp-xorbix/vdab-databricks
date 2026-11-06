import ProjectAppResourceGrantsEditor from "./ProjectAppResourceGrantsEditor";
import { useProjectDeploymentReadiness } from "../hooks/useProjectDeploymentReadiness";
import { useProjectDeployments } from "../hooks/useProjectDeployments";
import { useWorkspaceAppDeploymentTarget } from "../hooks/useWorkspaceAppDeploymentTarget";

interface Props {
  projectId: string;
  canEdit: boolean;
}

/** Manages resource grants for the project's linked Databricks App. */
export default function ProjectResourceSettingsPanel({ projectId, canEdit }: Readonly<Props>) {
  const history = useProjectDeployments(projectId);
  const readiness = useProjectDeploymentReadiness(canEdit ? projectId : undefined);
  const childApp = history.data?.childApp;
  const target = useWorkspaceAppDeploymentTarget(childApp?.appName);

  return (
    <div className="space-y-4">
      {history.isPending && <p role="status">Loading App resources…</p>}
      {history.isError && <p role="alert">{history.error instanceof Error ? history.error.message : "App resources could not be loaded."}</p>}
      {target.isError && <p role="alert">{target.error instanceof Error ? target.error.message : "Databricks App resources could not be loaded."}</p>}
      {readiness.isError && <p role="alert">{readiness.error instanceof Error ? readiness.error.message : "Required project resources could not be loaded."}</p>}
      <ProjectAppResourceGrantsEditor
        projectId={projectId}
        target={target.data ?? null}
        requiredResources={readiness.data?.appResources ?? []}
        canEdit={canEdit && Boolean(childApp) && !readiness.isPending && !readiness.isError}
        isLinked={Boolean(childApp)}
        onReload={() => void target.refetch()}
      />
    </div>
  );
}
