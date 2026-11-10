import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "./ui/use-toast";
import ProjectDeleteAction from "./ProjectDeleteAction";
import { deploySavedProjectAndOpen } from "../utils/deploySavedProject";
import { getDatabricksComputeStatePresentation } from "../utils/workspaceAppStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import type { IProject } from "../models/Project";
import { useProjectAppStatus } from "../hooks/useProjectAppStatus";
import { formatUpdatedAt } from "../utils/projectDateFormatting";

interface IProjectManagementProjectCardProps {
  project: IProject;
  isExporting: boolean;
  onExport: (projectId: string, projectName: string) => Promise<void>;
}

/** Renders a project summary and its owner actions. */
function ProjectManagementProjectCard({
  project,
  isExporting,
  onExport,
}: Readonly<IProjectManagementProjectCardProps>) {
  const { app, childApp, status } = useProjectAppStatus(project.id);
  const [isDeploying, setDeploying] = useState(false);
  const presentation = app?.computeState
    ? getDatabricksComputeStatePresentation(app.computeState)
    : null;
  const statusLabel = !childApp
    ? status === "Error" || status === "Checking" ? status : "Draft"
    : presentation?.shortLabel ?? status;
  const settings = project.deploymentSettings;
  const canDeployNow = Boolean(settings?.appName);

  async function deploy(): Promise<void> {
    if (!settings?.appName || isDeploying) return;
    setDeploying(true);
    try {
      const result = await deploySavedProjectAndOpen({
        projectId: project.id,
        mode: settings.mode,
        appName: settings.appName,
      });
      if (result.status === "started_without_url") {
        toast({
          title: "Deployment started",
          description:
            "The App upload started, but its page is not available yet. Open the builder and use Open app when it comes online.",
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
    <li>
      <article className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-[var(--card-shadow)] transition-all hover:border-primary/35 hover:shadow-md">
        <h3 className="mb-1 break-words text-lg font-semibold">
          <Link
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            to={`/apps/${project.id}`}
          >
            {project.name}
          </Link>
        </h3>
        <p className="mb-4 min-h-10 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">
          {project.description || "No description"}
        </p>
        <div className="mt-auto">
          <div className="mb-0.5 flex min-h-5 items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${presentation?.dotColorClass ?? "bg-muted-foreground"} ${presentation?.dotPulse ? "animate-pulse" : ""}`}
            />
            <span className={`text-sm font-medium ${presentation?.labelTextClass ?? "text-muted-foreground"}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Last edited: {formatUpdatedAt(project.updatedAt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-3">
            <Button
              className="flex-1"
              type="button"
              size="sm"
              variant="outline"
              asChild
            >
              <Link to={`/apps/${project.id}?section=settings`}>Edit</Link>
            </Button>
            <Button
              className="flex-1"
              type="button"
              size="sm"
              variant="outline"
              asChild
            >
              <Link to={`/apps/${project.id}`}>Open</Link>
            </Button>
            {canDeployNow ? (
              <Button className="flex-1 shadow-md hover:opacity-90" type="button" size="sm" disabled={isDeploying} onClick={() => void deploy()}>
                {isDeploying ? "Deploying…" : "Deploy"}
              </Button>
            ) : (
              <Button className="flex-1 shadow-md hover:opacity-90" type="button" size="sm" asChild>
                <Link to={`/apps/${project.id}?section=settings&focus=deployment-target`}>Deploy</Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label={`Actions for ${project.name}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  disabled={isExporting}
                  onClick={() => void onExport(project.id, project.name)}
                >
                  {isExporting ? "Exporting…" : "Export this app"}
                </DropdownMenuItem>
                <ProjectDeleteAction project={project} renderAsMenuItem />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </article>
    </li>
  );
}

export default ProjectManagementProjectCard;
