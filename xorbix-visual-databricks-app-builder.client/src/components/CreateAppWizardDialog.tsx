import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { databricksApi } from "../providers/DatabricksApi";
import { appApi } from "../providers/AppApi";
import {
  ApiError,
  CreateAppRequest,
  DatabricksAppCreationMode,
  type AppDto,
  type IDatabricksConnection,
} from "../models";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "./ui/use-toast";
import DatabricksAppNameCombobox from "./AppBuilderComponents/AppSettingsTab/DatabricksAppNameCombobox";
import { useDatabricksAppNames } from "../hooks/useDatabricksAppNames";
import { authLinkClassName } from "../constants/authBranding";
import { cn } from "../lib/utils";
import type { IProject } from "../models/Project";
import { useWorkspaceApps } from "../hooks/useWorkspaceApps";
import type { ProjectChildAppMode } from "../models/ProjectDeployments";

const WIZARD_STEPS = 3;

export interface IStandaloneProjectTarget {
  mode: ProjectChildAppMode;
  appName: string;
}

function formatCreateAppError(error: unknown): string {
  if (error instanceof ApiError) {
    const data = error.data as { detail?: string; title?: string } | undefined;
    if (data && typeof data.detail === "string" && data.detail.trim()) {
      return data.detail.trim();
    }
    return error.message || "Failed to create app.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to create app.";
}

export interface CreateAppWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (app: AppDto) => void;
  standaloneProjectMode?: boolean;
  onProjectCreated?: (
    name: string,
    description: string | null,
    target: IStandaloneProjectTarget,
  ) => Promise<void>;
}

export default function CreateAppWizardDialog({
  open,
  onOpenChange,
  onCreated,
  standaloneProjectMode = false,
  onProjectCreated,
}: CreateAppWizardDialogProps) {
  const [wizardStep, setWizardStep] = useState(0);
  const [workspaceConnections, setWorkspaceConnections] = useState<
    IDatabricksConnection[]
  >([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);

  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [databricksAppMode, setDatabricksAppMode] =
    useState<DatabricksAppCreationMode>(DatabricksAppCreationMode.LinkExisting);
  const [newAppName, setNewAppName] = useState("");
  const [newAppDescription, setNewAppDescription] = useState("");
  const [linkedDatabricksAppName, setLinkedDatabricksAppName] = useState("");
  const [newDatabricksAppName, setNewDatabricksAppName] = useState("");
  const [standaloneTargetMode, setStandaloneTargetMode] =
    useState<ProjectChildAppMode>("linkExisting");
  const [standaloneAppName, setStandaloneAppName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const standaloneAppsQuery = useWorkspaceApps(
    open && standaloneProjectMode && wizardStep === 2 && standaloneTargetMode === "linkExisting",
  );
  const standaloneApps = useMemo(
    () => standaloneAppsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [standaloneAppsQuery.data],
  );

  const parsedWorkspaceId = useMemo(() => {
    const n = parseInt(selectedConnectionId, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectedConnectionId]);

  const workspaceIdForNames =
    open &&
    wizardStep === 2 &&
    databricksAppMode === DatabricksAppCreationMode.LinkExisting &&
    parsedWorkspaceId != null
      ? parsedWorkspaceId
      : null;

  const { appNames, loadState, errorMessage: databricksNamesError } =
    useDatabricksAppNames(null, workspaceIdForNames);

  const resetWizard = useCallback(() => {
    setWizardStep(0);
    setWorkspaceConnections([]);
    setConnectionsLoading(false);
    setConnectionsError(null);
    setSelectedConnectionId("");
    setDatabricksAppMode(DatabricksAppCreationMode.LinkExisting);
    setNewAppName("");
    setNewAppDescription("");
    setLinkedDatabricksAppName("");
    setNewDatabricksAppName("");
    setStandaloneTargetMode("linkExisting");
    setStandaloneAppName("");
    setIsCreating(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }
    if (standaloneProjectMode) return;

    let cancelled = false;
    async function loadConnections() {
      setConnectionsLoading(true);
      setConnectionsError(null);
      try {
        const connections = await databricksApi.getWorkspacesByTenant();
        if (!cancelled) {
          setWorkspaceConnections(connections);
        }
      } catch {
        if (!cancelled) {
          setWorkspaceConnections([]);
          setConnectionsError(
            "Could not load workspace connections. Check your network and try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setConnectionsLoading(false);
        }
      }
    }

    void loadConnections();
    return () => {
      cancelled = true;
    };
  }, [open, resetWizard, standaloneProjectMode]);

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      resetWizard();
    }
    onOpenChange(next);
  };

  const canGoNextFromWorkspace =
    Boolean(selectedConnectionId) && parsedWorkspaceId !== null;

  const linkSelectionValid =
    loadState === "success" &&
    linkedDatabricksAppName.trim().length > 0 &&
    appNames.includes(linkedDatabricksAppName.trim());

  const canSubmit =
    newAppName.trim().length > 0 &&
    parsedWorkspaceId !== null &&
    !isCreating &&
    (databricksAppMode === DatabricksAppCreationMode.LinkExisting
      ? linkSelectionValid
      : newDatabricksAppName.trim().length > 0);

  const handleCreateApp = async () => {
    if (standaloneProjectMode) {
      if (!newAppName.trim() || !onProjectCreated || !canCreateStandaloneProject) return;
      setIsCreating(true);
      try {
        await onProjectCreated(newAppName.trim(), newAppDescription.trim() || null, {
          mode: standaloneTargetMode,
          appName: standaloneAppName.trim(),
        });
        resetWizard();
        onOpenChange(false);
      } catch (error) {
        toast({
          title: "Failed to create app",
          description: formatCreateAppError(error),
          variant: "destructive",
        });
      } finally {
        setIsCreating(false);
      }
      return;
    }
    if (!canSubmit || parsedWorkspaceId === null) return;

    const selectedDatabricksAppName =
      databricksAppMode === DatabricksAppCreationMode.LinkExisting
        ? linkedDatabricksAppName.trim()
        : newDatabricksAppName.trim();

    setIsCreating(true);
    try {
      const createdApp = await appApi.createApp(
        new CreateAppRequest({
          appName: newAppName.trim(),
          description: newAppDescription.trim() || undefined,
          workspaceConnectionId: parsedWorkspaceId,
          databricksAppMode,
          databricksAppName: selectedDatabricksAppName,
          databricksAppDescription:
            databricksAppMode === DatabricksAppCreationMode.CreateNew
              ? newAppDescription.trim() || undefined
              : undefined,
        }),
      );
      onCreated(createdApp);
      resetWizard();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to create app",
        description: formatCreateAppError(error),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const canCreateStandaloneProject =
    standaloneProjectMode &&
    (standaloneTargetMode === "createNew"
      ? /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(standaloneAppName.trim())
      : standaloneApps.some((app) => app.name === standaloneAppName.trim()));

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="bg-card p-6 rounded-xl shadow-xl max-w-md w-full border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Create New App
          </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground pt-1">
          {standaloneProjectMode
            ? `Step ${wizardStep + 1} of ${WIZARD_STEPS}. Confirm the workspace, choose an App target, then review your project.`
            : `Step ${wizardStep + 1} of ${WIZARD_STEPS}. Choose a workspace, then link or create a Databricks app, then enter app details.`}
        </DialogDescription>
        </DialogHeader>

        {standaloneProjectMode && wizardStep === 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">Databricks workspace</p>
              <p className="mt-1 text-muted-foreground">
                VDAB uses the workspace where this builder is installed. Apps and resources are selected from that workspace.
              </p>
            </div>
          </div>
        )}

        {standaloneProjectMode && wizardStep === 1 && (
          <div className="space-y-4">
            <Label htmlFor="wizard-standalone-target" className="text-sm font-medium text-foreground">
              Databricks App
            </Label>
            <p className="text-xs text-muted-foreground">
              Link an App already in this workspace or create a new App target. The App is linked when you deploy from the project.
            </p>
            <Select
              value={standaloneTargetMode}
              onValueChange={(value: string) => {
                setStandaloneTargetMode(value as ProjectChildAppMode);
                setStandaloneAppName("");
              }}
            >
              <SelectTrigger id="wizard-standalone-target" className="mt-2 w-full rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linkExisting">Link existing Databricks App</SelectItem>
                <SelectItem value="createNew">Create new Databricks App</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {standaloneProjectMode && wizardStep === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="wizard-app-name" className="text-sm font-medium text-foreground">
                App name
              </Label>
              <Input
                id="wizard-app-name"
                type="text"
                placeholder="Shown on your apps dashboard"
                value={newAppName}
                onChange={(event) => setNewAppName(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="wizard-description" className="text-sm font-medium text-foreground">
                {standaloneProjectMode ? "Description" : "Description (optional)"}
              </Label>
              <Textarea
                id="wizard-description"
                placeholder="Short description for this app"
                value={newAppDescription}
                onChange={(event) => setNewAppDescription(event.target.value)}
                className="mt-1 resize-none"
                rows={3}
              />
            </div>
          </div>
        )}
        {standaloneProjectMode && wizardStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">App</p>
              <h3 className="mt-1 font-semibold">{newAppName.trim()}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {newAppDescription.trim() || "No description"}
              </p>
            </div>
            {standaloneTargetMode === "createNew" ? (
              <div>
                <Label htmlFor="wizard-standalone-app-name" className="text-sm font-medium text-foreground">New Databricks App name</Label>
                <Input id="wizard-standalone-app-name" value={standaloneAppName} onChange={(event) => setStandaloneAppName(event.target.value)} placeholder="unique-app-name" className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">Use 2–30 lowercase letters, numbers, or hyphens.</p>
              </div>
            ) : (
              <div>
                <Label htmlFor="wizard-standalone-existing-app" className="text-sm font-medium text-foreground">Existing Databricks App</Label>
                {standaloneAppsQuery.isPending ? (
                  <p role="status" className="mt-2 text-sm text-muted-foreground">Loading Apps in this workspace…</p>
                ) : standaloneAppsQuery.isError ? (
                  <p role="alert" className="mt-2 text-sm text-destructive">{standaloneAppsQuery.error instanceof Error ? standaloneAppsQuery.error.message : "Workspace Apps could not be loaded."}</p>
                ) : (
                  <Select value={standaloneAppName} onValueChange={setStandaloneAppName}>
                    <SelectTrigger id="wizard-standalone-existing-app" className="mt-1 w-full"><SelectValue placeholder="Select an App…" /></SelectTrigger>
                    <SelectContent>{standaloneApps.map((app) => <SelectItem key={app.name} value={app.name}>{app.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {standaloneAppsQuery.hasNextPage && (
                  <Button type="button" variant="outline" className="mt-2" disabled={standaloneAppsQuery.isFetchingNextPage} onClick={() => void standaloneAppsQuery.fetchNextPage()}>
                    {standaloneAppsQuery.isFetchingNextPage ? "Loading more Apps…" : "Load more Apps"}
                  </Button>
                )}
              </div>
            )}
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">Review</p>
              <p className="mt-1 text-muted-foreground">{newAppName.trim() || "Untitled app"} · {standaloneTargetMode === "createNew" ? `Create ${standaloneAppName || "a new App"}` : `Link ${standaloneAppName || "an existing App"}`}</p>
            </div>
          </div>
        )}

        {!standaloneProjectMode && wizardStep === 0 && (
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="wizard-workspace"
                className="text-sm font-medium text-foreground"
              >
                Workspace connection
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose where this app&apos;s Databricks resources live. You need
                a connection before linking or creating a Databricks app.
              </p>
              {connectionsLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
              ) : connectionsError ? (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {connectionsError}
                </p>
              ) : workspaceConnections.length === 0 ? (
                <p className="mt-2 text-sm text-foreground">
                  No workspace connections are set up for your tenant. Add one
                  under{" "}
                  <Link
                    to="/databricks"
                    className={cn(authLinkClassName, "underline")}
                  >
                    Databricks connections
                  </Link>{" "}
                  to continue.
                </p>
              ) : (
                <Select
                  value={selectedConnectionId}
                  onValueChange={(value: string) =>
                    setSelectedConnectionId(value)
                  }
                >
                  <SelectTrigger
                    id="wizard-workspace"
                    className="mt-2 w-full rounded-md"
                    style={{ border: "1px solid #CBD5E1" }}
                  >
                    <SelectValue placeholder="Select workspace connection…" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaceConnections.map((conn) => (
                      <SelectItem key={conn.pkId} value={conn.pkId.toString()}>
                        {conn.workspaceDisplayName || conn.workspaceUrl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        {!standaloneProjectMode && wizardStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="wizard-strategy"
                className="text-sm font-medium text-foreground"
              >
                Databricks app
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Link an app that already exists in this workspace, or create a
                new one (created in Databricks when you finish this wizard).
              </p>
              <Select
                value={databricksAppMode}
                onValueChange={(value: string) => {
                  setDatabricksAppMode(value as DatabricksAppCreationMode);
                  setLinkedDatabricksAppName("");
                  setNewDatabricksAppName("");
                }}
              >
                <SelectTrigger
                  id="wizard-strategy"
                  className="mt-2 w-full rounded-md"
                  style={{ border: "1px solid #CBD5E1" }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DatabricksAppCreationMode.LinkExisting}>
                    Link existing Databricks app
                  </SelectItem>
                  <SelectItem value={DatabricksAppCreationMode.CreateNew}>
                    Create new Databricks app
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!standaloneProjectMode && wizardStep === 2 && (
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="wizard-app-name"
                className="text-sm font-medium text-foreground"
              >
                VDAB App Name
              </Label>
              <Input
                id="wizard-app-name"
                type="text"
                placeholder="Shown on your apps dashboard"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="wizard-description"
                className="text-sm font-medium text-foreground"
              >
                Description (optional)
              </Label>
              <Textarea
                id="wizard-description"
                placeholder="Short description for this VDAB app"
                value={newAppDescription}
                onChange={(e) => setNewAppDescription(e.target.value)}
                className="mt-1 resize-none"
                rows={3}
              />
              {databricksAppMode === DatabricksAppCreationMode.CreateNew && (
                <p className="mt-1 text-xs text-muted-foreground">
                  For &quot;create new&quot;, this text is also sent to Databricks
                  as the app description when supported by the workspace API.
                </p>
              )}
            </div>

            {databricksAppMode === DatabricksAppCreationMode.LinkExisting ? (
              <DatabricksAppNameCombobox
                appId={null}
                workspaceConnectionId={selectedConnectionId}
                value={linkedDatabricksAppName}
                onChange={setLinkedDatabricksAppName}
                appNames={appNames}
                loadState={loadState}
                errorMessage={databricksNamesError}
              />
            ) : (
              <div>
                <Label
                  htmlFor="wizard-new-dbx-name"
                  className="text-sm font-medium text-foreground"
                >
                  New Databricks App Name
                </Label>
                <Input
                  id="wizard-new-dbx-name"
                  type="text"
                  placeholder="Unique name in the workspace"
                  value={newDatabricksAppName}
                  onChange={(e) => setNewDatabricksAppName(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-wrap justify-end gap-2 mt-6">
          <Button
            variant="outline"
            type="button"
            onClick={() => handleDialogOpenChange(false)}
          >
            Cancel
          </Button>
          {wizardStep > 0 && (
            <Button
              variant="outline"
              type="button"
              onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
          )}
          {wizardStep < (standaloneProjectMode ? 2 : 2) && (
            <Button
              type="button"
              disabled={
                !standaloneProjectMode && wizardStep === 0 &&
                (!canGoNextFromWorkspace ||
                  connectionsLoading ||
                  workspaceConnections.length === 0 ||
                  connectionsError !== null)
              }
              onClick={() => {
                if (!standaloneProjectMode && wizardStep === 0 && !canGoNextFromWorkspace) return;
                setWizardStep((s) => Math.min(2, s + 1));
              }}
            >
              {standaloneProjectMode ? "Continue" : "Next"}
            </Button>
          )}
          {wizardStep === 2 && (
            <Button
              type="button"
              disabled={standaloneProjectMode
                ? !newAppName.trim() || !canCreateStandaloneProject || isCreating
                : !canSubmit}
              onClick={() => void handleCreateApp()}
            >
              {isCreating
                ? "Creating…"
                : standaloneProjectMode
                  ? standaloneTargetMode === "linkExisting"
                    ? "Create and link project"
                    : "Create project"
                  : "Create app"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
