import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useCreateProject } from "../hooks/useCreateProject";
import { useProjects } from "../hooks/useProjects";
import { useExportProject } from "../hooks/useExportProject";
import ProjectManagementProjectCard from "../components/ProjectManagementProjectCard";
import ProjectImportPanel from "../components/ProjectImportPanel";

interface IProjectManagementPageProps {
  title?: string;
}

/** Lists install-local projects and creates new builder projects. */
function ProjectManagementPage({
  title = "Your VDAB projects",
}: Readonly<IProjectManagementPageProps>) {
  const projectsQuery = useProjects();
  const createProjectMutation = useCreateProject();
  const exportProjectMutation = useExportProject();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const createdProject = await createProjectMutation.mutateAsync({
        name,
        description: description.trim() || null,
      });
      await navigate(`/apps/${createdProject.id}`);
    } catch {
      // The mutation state renders the safe API error below.
    }
  }

  async function handleExport(projectId: string, projectName: string) {
    setExportError(null);
    try {
      const bundle = await exportProjectMutation.mutateAsync(projectId);
      const file = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${
        projectName
          .toLocaleLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "vdab-project"
      }.vdab.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "The project could not be exported.",
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Projects are stored in the Lakebase database bound to this VDAB
            installation.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/workspace/apps">Browse workspace apps</Link>
        </Button>
      </header>

      <section
        aria-labelledby="create-project-heading"
        className="rounded-xl border border-border bg-card p-6"
      >
        <h2 id="create-project-heading" className="text-lg font-semibold">
          Create a project
        </h2>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => void handleCreate(event)}
        >
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              autoComplete="off"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              name="description"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {createProjectMutation.isError && (
            <p role="alert">
              {createProjectMutation.error instanceof Error
                ? createProjectMutation.error.message
                : "The project could not be created."}
            </p>
          )}
          <div>
            <Button type="submit" disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending
                ? "Creating project…"
                : "Create project"}
            </Button>
          </div>
        </form>
      </section>

      <ProjectImportPanel />

      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      )}

      <section aria-labelledby="projects-heading" className="space-y-4">
        <h2 id="projects-heading" className="text-lg font-semibold">
          Projects you can access
        </h2>
        {projectsQuery.isPending ? (
          <p role="status" aria-live="polite">
            Loading projects…
          </p>
        ) : projectsQuery.isError ? (
          <p role="alert">
            {projectsQuery.error instanceof Error
              ? projectsQuery.error.message
              : "Could not load projects."}
          </p>
        ) : projectsQuery.data.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <h3 className="font-semibold">No projects yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a project to start building a Databricks app.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {projectsQuery.data.items.map((project) => (
              <ProjectManagementProjectCard
                key={project.id}
                project={project}
                isExporting={exportProjectMutation.isPending}
                onExport={handleExport}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default ProjectManagementPage;
