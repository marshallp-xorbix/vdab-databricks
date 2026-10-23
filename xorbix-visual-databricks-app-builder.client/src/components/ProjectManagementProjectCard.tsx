import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import ProjectDeleteAction from "./ProjectDeleteAction";
import type { IProject } from "../models/Project";

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
  return (
    <li>
      <article className="h-full rounded-lg border border-border bg-card p-5">
        <h3 className="break-words text-lg font-semibold">
          <Link
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            to={`/apps/${project.id}`}
          >
            {project.name}
          </Link>
        </h3>
        {project.description && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {project.description}
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Access: {project.callerRole}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Version {project.version}
        </p>
        <Button
          className="mt-4"
          type="button"
          variant="outline"
          disabled={isExporting}
          onClick={() => void onExport(project.id, project.name)}
        >
          {isExporting ? "Preparing export…" : "Export project"}
        </Button>
        <ProjectDeleteAction project={project} />
      </article>
    </li>
  );
}

export default ProjectManagementProjectCard;
