import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import CreateAppWizardDialog from "../components/CreateAppWizardDialog";
import type { ProjectCreationTarget } from "../types/projectCreationTarget";
import type { IStandaloneProjectExport } from "../models/ProjectPortability";
import { useCreateProject } from "../hooks/useCreateProject";
import { useProjects } from "../hooks/useProjects";
import { useExportProject } from "../hooks/useExportProject";
import { useStartProjectDeployment } from "../hooks/useStartProjectDeployment";
import { toast } from "../components/ui/use-toast";
import ProjectManagementProjectCard from "../components/ProjectManagementProjectCard";
import ProjectImportPanel from "../components/ProjectImportPanel";
import ProjectExportPreviewDialog from "../components/ProjectExportPreviewDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

interface IProjectManagementPageProps {
  title?: string;
}

/** Lists install-local projects and creates new builder projects. */
function ProjectManagementPage({
  title = "Apps",
}: Readonly<IProjectManagementPageProps>) {
  const projectsQuery = useProjects();
  const createProjectMutation = useCreateProject();
  const startProjectDeploymentMutation = useStartProjectDeployment();
  const exportProjectMutation = useExportProject();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isExportingAll, setExportingAll] = useState(false);
  const [exportPreview, setExportPreview] = useState<{
    title: string;
    filename: string;
    payload: unknown;
    notice: string;
  } | null>(null);

  async function handleCreate(
    name: string,
    description: string | null,
    target: ProjectCreationTarget,
  ) {
    const createdProject = await createProjectMutation.mutateAsync({
      name,
      description,
      deploymentSettings: { ...target, workspacePath: null },
    });
    try {
      await startProjectDeploymentMutation.mutateAsync({
        projectId: createdProject.id,
        mode: target.mode,
        appName: target.appName,
        confirmOverwrite: target.mode === "linkExisting",
      });
    } catch (error) {
      toast({
        title: "Project created, App deployment needs attention",
        description: error instanceof Error ? error.message : "Open Deployment settings to retry.",
        variant: "destructive",
      });
    }
    await navigate(`/apps/${createdProject.id}`);
  }

  const filteredProjects = (projectsQuery.data?.items ?? []).filter((project) =>
    project.name.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()),
  );

  async function handleExport(projectId: string, projectName: string) {
    setExportError(null);
    setExportNotice(null);
    try {
      const bundle = await exportProjectMutation.mutateAsync(projectId);
      const filename = `${
        projectName
          .toLocaleLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "vdab-project"
      }.vdab.json`;
      setExportPreview({
        title: `Export ${projectName}`,
        filename,
        payload: bundle,
        notice: `Exported ${projectName}. Select workspace resources again after import.`,
      });
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "The project could not be exported.",
      );
    }
  }

  async function handleExportAll() {
    setExportError(null);
    setExportNotice(null);
    setExportingAll(true);
    try {
      const projects = projectsQuery.data?.items ?? [];
      const bundles: IStandaloneProjectExport[] = [];
      for (const project of projects) {
        bundles.push(await exportProjectMutation.mutateAsync(project.id));
      }
      setExportPreview({
        title: "Export all apps",
        filename: "vdab-all-projects.vdab.json",
        payload: {
          format: "vdab-project-collection",
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          projects: bundles,
        },
        notice:
          "Exported all apps. Select workspace resources again after import.",
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Apps could not be exported.");
    } finally {
      setExportingAll(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 overscroll-none px-8 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="shrink-0 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="relative block w-full sm:w-64">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search projects"
              placeholder="Search apps…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </label>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="shrink-0 rounded-lg shadow-md hover:opacity-90"
          >
            Create New App
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="Project import and export actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setImportDialogOpen(true);
                }}
              >
                Import apps…
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isExportingAll || projectsQuery.isPending || (projectsQuery.data?.items.length ?? 0) === 0} onSelect={() => void handleExportAll()}>
                {isExportingAll ? "Exporting apps…" : "Export all apps"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {exportNotice && (
        <p role="status" className="text-sm text-muted-foreground">{exportNotice}</p>
      )}
      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      )}

      <section aria-label="Apps" className="space-y-4">
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
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <h3 className="font-semibold">
              {searchQuery ? "No apps match your search" : "No apps yet"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery
                ? "Try another app name."
                : "Create your first app to start building in this workspace."}
            </p>
            {!searchQuery && (
              <Button
                className="mt-5"
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Your First App
              </Button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {filteredProjects.map((project) => (
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

      <CreateAppWizardDialog
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onProjectCreated={handleCreate}
      />
      <Dialog open={isImportDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import a standalone project</DialogTitle>
            <DialogDescription>
              Import a VDAB project into this workspace.
            </DialogDescription>
          </DialogHeader>
          <ProjectImportPanel className="border-0 bg-transparent p-0 shadow-none" />
        </DialogContent>
      </Dialog>
      <ProjectExportPreviewDialog
        open={exportPreview !== null}
        title={exportPreview?.title ?? "Export"}
        filename={exportPreview?.filename ?? "export.vdab.json"}
        payload={exportPreview?.payload ?? null}
        onClose={() => setExportPreview(null)}
        onDownload={() => {
          if (!exportPreview) return;
          downloadJson(exportPreview.payload, exportPreview.filename);
          setExportNotice(exportPreview.notice);
          setExportPreview(null);
        }}
      />
    </main>
  );
}

export default ProjectManagementPage;

function downloadJson(value: unknown, filename: string): void {
  const file = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}
