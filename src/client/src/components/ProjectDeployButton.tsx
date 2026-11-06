import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudUpload, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "./ui/use-toast";
import { deploySavedProjectAndOpen } from "../utils/deploySavedProject";
import { getChatDeployBlockingMessage } from "../utils/chatDeployBlocking";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectDeploymentSettings } from "../models/ProjectDeploymentSettings";

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
  const missingTarget = !deploymentSettings?.appName || !deploymentSettings.workspacePath;

  async function deploy(): Promise<void> {
    if (!canEdit || isSaving || isDeploying) return;
    if (missingTarget) {
      navigate(`/apps/${projectId}?section=settings&focus=deployment-target`);
      toast({
        title: "Deployment needs a target",
        description: "Set the child App name and workspace folder, then choose Deploy again.",
      });
      return;
    }
    const blocker = getChatDeployBlockingMessage(components);
    if (blocker) {
      toast({ title: "Deployment blocked", description: blocker, variant: "destructive" });
      return;
    }
    if (isCustomModulesDirty) {
      toast({
        title: "Save custom modules first",
        description: "Save the custom Python module before deploying this App.",
        variant: "destructive",
      });
      return;
    }
    if (hasUnsavedChanges) {
      const saved = await onSave();
      if (!saved) {
        toast({
          title: "Save failed",
          description: "The project could not be saved, so deployment did not start.",
          variant: "destructive",
        });
        return;
      }
    }
    setDeploying(true);
    try {
      await deploySavedProjectAndOpen({
        projectId,
        mode: deploymentSettings.mode,
        appName: deploymentSettings.appName,
      });
    } catch (error) {
      toast({
        title: "Deployment failed",
        description: error instanceof Error ? error.message : "The App deployment could not be started.",
        variant: "destructive",
      });
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

export default ProjectDeployButton;
