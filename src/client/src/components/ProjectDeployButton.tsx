import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudUpload, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "./ui/use-toast";
import { deploySavedProjectAndOpen } from "../utils/deploySavedProject";
import { getChatDeployBlockingMessage } from "../utils/chatDeployBlocking";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectDeploymentSettings } from "../models/ProjectDeploymentSettings";
import type { IWorkspaceSecretResourceSelection } from "../models/ProjectDeployments";
import { useProjectDeploymentReadiness } from "../hooks/useProjectDeploymentReadiness";
import { useProjectDeployments } from "../hooks/useProjectDeployments";
import { useWorkspaceAppDeploymentTarget } from "../hooks/useWorkspaceAppDeploymentTarget";
import { getProjectDeploymentReadiness } from "../api/projectDeploymentsApi";

interface IProjectDeployButtonProps {
  projectId: string;
  canEdit: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isCustomModulesDirty: boolean;
  deploymentSettings: IProjectDeploymentSettings | null;
  components: readonly IProjectComponent[];
  onSave: () => Promise<boolean>;
  className?: string;
}

/** Saves the draft when needed, deploys the saved snapshot, and opens the child App page. */
function ProjectDeployButton({
  projectId,
  canEdit,
  isSaving,
  hasUnsavedChanges,
  isCustomModulesDirty,
  deploymentSettings,
  components,
  onSave,
  className,
}: Readonly<IProjectDeployButtonProps>) {
  const navigate = useNavigate();
  const [isDeploying, setDeploying] = useState(false);
  const deploymentsQuery = useProjectDeployments(projectId);
  const readinessQuery = useProjectDeploymentReadiness(
    canEdit ? projectId : undefined,
  );
  const targetQuery = useWorkspaceAppDeploymentTarget(
    deploymentsQuery.data?.childApp?.appName ?? deploymentSettings?.appName,
  );
  const missingTarget = !deploymentSettings?.appName;

  async function deploy(): Promise<void> {
    if (!canEdit || isSaving || isDeploying || !deploymentSettings) return;
    if (missingTarget) {
      navigate(`/apps/${projectId}?section=settings&focus=deployment-target`);
      toast({
        title: "Deployment needs a target",
        description:
          "Set the child App name, then choose Deploy again. Leave the workspace folder blank to use the default VDAB folder.",
      });
      return;
    }
    if (hasUnsavedChanges || isCustomModulesDirty) {
      const saved = await onSave();
      if (!saved) {
        toast({
          title: "Save failed",
          description:
            "The project could not be saved, so deployment did not start.",
          variant: "destructive",
        });
        return;
      }
    }
    let readiness = readinessQuery.data;
    try {
      readiness = await getProjectDeploymentReadiness(projectId);
    } catch (error) {
      toast({
        title: "Deployment readiness unavailable",
        description:
          error instanceof Error
            ? error.message
            : "Deployment prerequisites could not be checked.",
        variant: "destructive",
      });
      return;
    }
    if (readiness.blockers.length > 0) {
      navigate(`/apps/${projectId}?section=settings&settings=deployment`);
      toast({
        title: "Deployment blocked",
        description: readiness.blockers.map((blocker) => blocker.detail).join(" "),
        variant: "destructive",
      });
      return;
    }
    const blocker = getChatDeployBlockingMessage(
      components,
      targetQuery.data?.appResources ?? readiness.appResources,
    );
    if (blocker) {
      toast({
        title: "Deployment blocked",
        description: blocker,
        variant: "destructive",
      });
      return;
    }
    setDeploying(true);
    try {
      const result = await deploySavedProjectAndOpen({
        projectId,
        mode: deploymentSettings.mode,
        appName: deploymentSettings.appName,
        secretResources: secretSelectionsFromTarget(
          targetQuery.data?.secretResources ?? [],
        ),
      });
      if (result.status === "started_without_url") {
        toast({
          title: "Deployment started",
          description:
            "The App upload started, but its page is not available yet. Use Open app when it comes online.",
        });
      }
    } catch (error) {
      toast({
        title: "Deployment failed",
        description:
          error instanceof Error
            ? error.message
            : "The App deployment could not be started.",
        variant: "destructive",
      });
    } finally {
      setDeploying(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!canEdit || isSaving || isDeploying}
      onClick={() => void deploy()}
      className={className}
    >
      {isDeploying ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <CloudUpload className="mr-1 h-3 w-3" />
      )}
      {isDeploying ? "Deploying…" : "Deploy"}
    </Button>
  );
}

function secretSelectionsFromTarget(
  secrets: ReadonlyArray<{
    name: string;
    secret: { scope: string; key: string };
  }>,
): IWorkspaceSecretResourceSelection[] {
  return secrets.map((resource) => ({
    name: resource.name,
    scope: resource.secret.scope,
    key: resource.secret.key,
  }));
}

export default ProjectDeployButton;
