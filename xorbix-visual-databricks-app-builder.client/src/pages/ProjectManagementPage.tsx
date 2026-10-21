import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useCreateProject } from "../hooks/useCreateProject";
import { useProjects } from "../hooks/useProjects";
import { useExportProject } from "../hooks/useExportProject";
import { useImportProject } from "../hooks/useImportProject";
import type { IProjectImportResult } from "../models/ProjectPortability";

interface IProjectManagementPageProps {
  title?: string;
}

const MAX_PROJECT_IMPORT_BYTES = 1_048_576;

/** Lists install-local projects and creates new builder projects. */
function ProjectManagementPage({
  title = "Your VDAB projects",
}: Readonly<IProjectManagementPageProps>) {
  const projectsQuery = useProjects();
  const createProjectMutation = useCreateProject();
  const exportProjectMutation = useExportProject();
  const importProjectMutation = useImportProject();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<IProjectImportResult | null>(null);
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

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!selectedFile) return;
    setImportError(null);
    setImportResult(null);
    if (selectedFile.size > MAX_PROJECT_IMPORT_BYTES) {
      setImportError("Choose a project export smaller than 1 MiB.");
      return;
    }
    try {
      const bundle: unknown = JSON.parse(await selectedFile.text());
      const result = await importProjectMutation.mutateAsync(bundle);
      setImportResult(result);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The project could not be imported.");
    }
  }

  async function handleExport(projectId: string, projectName: string) {
    setExportError(null);
    try {
      const bundle = await exportProjectMutation.mutateAsync(projectId);
      const file = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${projectName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vdab-project"}.vdab.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The project could not be exported.");
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
        <form className="mt-4 grid gap-4" onSubmit={(event) => void handleCreate(event)}>
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

      <section aria-labelledby="import-project-heading" className="rounded-xl border border-border bg-card p-6">
        <h2 id="import-project-heading" className="text-lg font-semibold">Import a standalone project</h2>
        <p id="project-import-help" className="mt-2 text-sm text-muted-foreground">
          Choose a VDAB v1 project file. Imported workspace resources and the child App must be selected again.
        </p>
        <div className="mt-4 grid gap-2">
          <Label htmlFor="project-import-file">Project JSON file</Label>
          <Input
            id="project-import-file"
            type="file"
            accept="application/json,.json"
            aria-describedby={importError ? "project-import-help project-import-error" : "project-import-help"}
            aria-invalid={importError !== null}
            disabled={importProjectMutation.isPending}
            onChange={(event) => void handleImport(event)}
          />
        </div>
        {importProjectMutation.isPending && <p role="status" className="mt-3">Importing project…</p>}
        {importError && <p id="project-import-error" role="alert" className="mt-3 text-sm text-destructive">{importError}</p>}
        {importResult && (
          <div className="mt-4 rounded-md border border-border p-4" role="status" aria-live="polite">
            <p>
              Imported <Link className="underline underline-offset-4" to={`/apps/${importResult.project.id}`}>{importResult.project.name}</Link>.
              {" "}Choose a child App before deploying.
            </p>
            {importResult.unresolvedResources.length > 0 ? (
              <div className="mt-2">
                <p className="font-medium">Select these resources again in the project editor:</p>
                <ul className="mt-1 list-disc pl-5">
                  {importResult.unresolvedResources.map((reference) => (
                    <li key={reference.key}>
                      {reference.kind}: {reference.label}
                      {reference.componentKeys?.length ? ` — components ${reference.componentKeys.join(", ")}` : ""}
                      {reference.workflowNodeIds?.length ? ` — workflow actions ${reference.workflowNodeIds.join(", ")}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2">No workspace resources need reselection.</p>
            )}
          </div>
        )}
      </section>

      {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}

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
              <li key={project.id}>
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
                    disabled={exportProjectMutation.isPending}
                    onClick={() => void handleExport(project.id, project.name)}
                  >
                    {exportProjectMutation.isPending ? "Preparing export…" : "Export project"}
                  </Button>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default ProjectManagementPage;
