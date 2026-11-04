import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useWorkspaceApps } from "../hooks/useWorkspaceApps";
import type { ProjectCreationTarget } from "../types/projectCreationTarget";
import type { ProjectChildAppMode } from "../models/ProjectDeployments";

const APP_NAME_PATTERN = /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/;
const LAST_STEP = 1;

export interface CreateAppWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (
    name: string,
    description: string | null,
    target: ProjectCreationTarget,
  ) => Promise<void>;
}

/** Collects project details and its optional Databricks App deployment target. */
export default function CreateAppWizardDialog({
  open,
  onOpenChange,
  onProjectCreated,
}: Readonly<CreateAppWizardDialogProps>) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetMode, setTargetMode] = useState<ProjectChildAppMode>("linkExisting");
  const [appName, setAppName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const appsQuery = useWorkspaceApps(
    open && step === LAST_STEP && targetMode === "linkExisting",
  );
  const apps = useMemo(
    () => appsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [appsQuery.data],
  );
  const canCreateTarget =
    targetMode === "createNew"
      ? APP_NAME_PATTERN.test(appName.trim())
      : apps.some((app) => app.name === appName.trim());
  const canCreate = name.trim().length > 0 && canCreateTarget && !isCreating;

  const resetDialog = useCallback(() => {
    setStep(0);
    setName("");
    setDescription("");
    setTargetMode("linkExisting");
    setAppName("");
    setIsCreating(false);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDialog();
    onOpenChange(nextOpen);
  };

  async function handleCreateProject() {
    if (!canCreate) return;
    setIsCreating(true);
    try {
      await onProjectCreated(name.trim(), description.trim() || null, {
        mode: targetMode,
        appName: appName.trim(),
      });
      resetDialog();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to create project",
        description:
          error instanceof Error
            ? error.message
            : "The project could not be created.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Create New App
          </DialogTitle>
          <DialogDescription className="pt-1 text-xs text-muted-foreground">
            Step {step + 1} of {LAST_STEP + 1}. Choose a workspace App target,
            then name your project.
          </DialogDescription>
        </DialogHeader>

        {step === 0 ? (
          <section className="space-y-4" aria-label="Workspace App target">
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">Databricks workspace</p>
              <p className="mt-1 text-muted-foreground">
                This builder uses the workspace where it is installed.
              </p>
            </div>
            <div>
              <Label htmlFor="wizard-target-mode">Databricks App target</Label>
              <Select
                value={targetMode}
                onValueChange={(value: string) => {
                  setTargetMode(value as ProjectChildAppMode);
                  setAppName("");
                }}
              >
                <SelectTrigger id="wizard-target-mode" className="mt-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkExisting">Link an existing App</SelectItem>
                  <SelectItem value="createNew">Create a new App</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        ) : (
          <section className="space-y-4" aria-label="Project details">
            <div>
              <Label htmlFor="wizard-project-name">App name</Label>
              <Input
                id="wizard-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Shown on your apps dashboard"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="wizard-project-description">Description</Label>
              <Textarea
                id="wizard-project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short description for this app"
                className="mt-1 resize-none"
                rows={3}
              />
            </div>
            {targetMode === "createNew" ? (
              <div>
                <Label htmlFor="wizard-new-app-name">New Databricks App name</Label>
                <Input
                  id="wizard-new-app-name"
                  value={appName}
                  onChange={(event) => setAppName(event.target.value)}
                  placeholder="unique-app-name"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use 2–30 lowercase letters, numbers, or hyphens.
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="wizard-existing-app">Existing Databricks App</Label>
                {appsQuery.isPending ? (
                  <p role="status" className="mt-2 text-sm text-muted-foreground">
                    Loading Apps in this workspace…
                  </p>
                ) : appsQuery.isError ? (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {appsQuery.error instanceof Error
                      ? appsQuery.error.message
                      : "Workspace Apps could not be loaded."}
                  </p>
                ) : (
                  <Select value={appName} onValueChange={setAppName}>
                    <SelectTrigger id="wizard-existing-app" className="mt-1 w-full">
                      <SelectValue placeholder="Select an App…" />
                    </SelectTrigger>
                    <SelectContent>
                      {apps.map((app) => (
                        <SelectItem key={app.name} value={app.name}>
                          {app.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {appsQuery.hasNextPage && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    disabled={appsQuery.isFetchingNextPage}
                    onClick={() => void appsQuery.fetchNextPage()}
                  >
                    {appsQuery.isFetchingNextPage ? "Loading more Apps…" : "Load more Apps"}
                  </Button>
                )}
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Review
              </p>
              <p className="mt-1 font-semibold">{name.trim() || "Untitled app"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {targetMode === "createNew" ? "Create" : "Link"} {appName || "an App"}
              </p>
            </div>
          </section>
        )}

        <DialogFooter className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {step > 0 && (
            <Button variant="outline" type="button" onClick={() => setStep(0)}>
              Back
            </Button>
          )}
          {step < LAST_STEP ? (
            <Button type="button" onClick={() => setStep(LAST_STEP)}>
              Continue
            </Button>
          ) : (
            <Button type="button" disabled={!canCreate} onClick={() => void handleCreateProject()}>
              {isCreating ? "Creating…" : targetMode === "linkExisting" ? "Create and link project" : "Create project"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
