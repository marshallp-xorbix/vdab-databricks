import { useEffect, useState } from "react";
import { appApi } from "../providers/AppApi";
import { databricksApi } from "../providers/DatabricksApi";
import { useIdentity } from "../context/IdentityContext";
import { toast } from "../components/ui/use-toast";
import { showAuthFailureToast } from "../utils/authToast";
import { useDatabricksWorkspaceAuth } from "./useDatabricksWorkspaceAuth";
import type { VdabComponent } from "../types/components/vdabComponent";
import type { WorkflowDefinition } from "../types/workflow";
import { useLogger } from "../logger/useLogger";
import type { NormalizedAppResource } from "../models/DatabricksAppModels";
import { getGenieChatDeployBlockingMessage } from "../utils/genieChatValidation";
import { getModelChatDeployBlockingMessage } from "../utils/modelChatValidation";
import { normalizeComponentsHeightPixels } from "../utils/componentProps/heightPixelsUtils";

interface UseAppDeploymentProps {
  formComponents?: VdabComponent[];
  workflowDefinition?: WorkflowDefinition;
  appId?: string;
  normalizedAppResources?: NormalizedAppResource[];
  onSave?: () => Promise<void>;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: () => void;
}

interface ApiFormComponent extends Record<string, unknown> {
  Id: string;
  Type: string;
  Props: Record<string, unknown>;
}

const transformComponentsForApi = (
  components: VdabComponent[],
): ApiFormComponent[] => {
  return components.map((component) => ({
    Id: component.id,
    Category: component.category,
    Type: component.type,
    CodeName: component.codeName,
    Props: component.props || {},
    Bindings: component.bindings || {},
    SupportedBindings: component.supportedBindings,
    SupportedEvents: component.supportedEvents,
    Children: component.children || [],
    Layout: component.layout,
    SchemaVersion: component.schemaVersion,
  }));
};

export const useAppDeployment = ({
  formComponents = [],
  workflowDefinition,
  appId,
  normalizedAppResources = [],
  onSave,
  onSaveStart,
  onSaveSuccess,
  onSaveError,
}: UseAppDeploymentProps) => {
  const logger = useLogger("useAppDeployment");
  const { user } = useIdentity();
  const [isDeploying, setIsDeploying] = useState(false);
  const [appWorkspacePath, setAppWorkspacePath] = useState<string>("");
  const [databricksAppName, setDatabricksAppName] = useState<string>("");

  const handleAuthenticate = useDatabricksWorkspaceAuth(
    appId ? Number.parseInt(appId) : null,
  );

  useEffect(() => {
    const fetchAppData = async () => {
      if (!appId) return;

      try {
        const app = await appApi.getAppById(Number.parseInt(appId));
        setAppWorkspacePath(app.workspacePath || "");
        setDatabricksAppName(app.databricksAppName || "");
      } catch (error) {
        logger.UI.error("Failed to fetch app data for deployment:", error);
      }
    };

    fetchAppData();
  }, [appId]);

  const handleDeployApp = async () => {
    if (!user) {
      toast({
        title: "Deployment failed",
        description: "You must be signed in to deploy this app.",
        variant: "destructive",
      });
      return;
    }

    if (!appId) {
      toast({
        title: "Deployment failed",
        description: "App not found for deployment.",
        variant: "destructive",
      });
      return;
    }

    if (!appWorkspacePath) {
      toast({
        title: "Deployment failed",
        description:
          "No workspace path configured for this app. Please set it in the app settings.",
        variant: "destructive",
      });
      return;
    }

    if (!databricksAppName) {
      toast({
        title: "Deployment failed",
        description:
          "No Databricks app name configured for this app. Please set it in the app settings.",
        variant: "destructive",
      });
      return;
    }

    const genieBlock = getGenieChatDeployBlockingMessage(
      formComponents,
      normalizedAppResources,
    );
    if (genieBlock) {
      toast({
        title: "Deployment blocked",
        description: genieBlock,
        variant: "destructive",
      });
      return;
    }

    const modelChatBlock = getModelChatDeployBlockingMessage(
      formComponents,
      normalizedAppResources,
    );
    if (modelChatBlock) {
      toast({
        title: "Deployment blocked",
        description: modelChatBlock,
        variant: "destructive",
      });
      return;
    }

    if (onSave) {
      try {
        logger.UI.log("[useAppDeployment] Auto-saving before deployment...");
        onSaveStart?.();
        await onSave();
        onSaveSuccess?.();
        logger.UI.log("[useAppDeployment] Auto-save completed");
      } catch (saveError) {
        logger.UI.error("[useAppDeployment] Auto-save failed:", saveError);
        onSaveError?.();
      }
    }

    setIsDeploying(true);

    try {
      const apiComponents = transformComponentsForApi(
        normalizeComponentsHeightPixels(formComponents),
      );

      const deployResult = await databricksApi.deployApp({
        AppId: Number.parseInt(appId, 10),
        Description: "Deployed from VDAB App Builder",
        FormComponents: apiComponents,
        WorkflowDefinition: workflowDefinition,
        DatabricksAppName: databricksAppName,
        TargetPath: appWorkspacePath,
      });

      if (deployResult.appUrl) {
        window.open(deployResult.appUrl, "_blank");
      }
    } catch (error) {
      logger.UI.error("Deploy app error:", error);
      const handled = showAuthFailureToast(
        error,
        "Deployment failed",
        "Unknown error",
        handleAuthenticate,
      );

      if (!handled) {
        toast({
          title: "Deployment failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    handleDeployApp,
    isDeploying,
    appWorkspacePath,
  };
};
