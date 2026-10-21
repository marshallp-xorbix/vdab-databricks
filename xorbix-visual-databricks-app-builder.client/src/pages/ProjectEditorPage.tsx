import { useEffect, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import ProjectComponentsEditor from "../components/ProjectComponentsEditor";
import ProjectMetadataEditor from "../components/ProjectMetadataEditor";
import ProjectCollaboratorsEditor from "../components/ProjectCollaboratorsEditor";
import { ProjectWorkflowEditor } from "../components/ProjectWorkflowEditor";
import { useProject } from "../hooks/useProject";
import { useProjectComponents } from "../hooks/useProjectComponents";
import { useReplaceProjectComponents } from "../hooks/useReplaceProjectComponents";
import { useProjectWorkflow } from "../hooks/useProjectWorkflow";
import { useReplaceProjectWorkflow } from "../hooks/useReplaceProjectWorkflow";
import { useComponentRegistry } from "../hooks/useComponentRegistry";
import { useGenerateProjectPreview } from "../hooks/useGenerateProjectPreview";
import { useUpdateProject } from "../hooks/useUpdateProject";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";

interface IProjectEditorPageProps {
  title?: string;
}

type ProjectEditorSection = "components" | "workflows" | "collaborators";

/** Reopens a project and saves its metadata with version conflict protection. */
function ProjectEditorPage({
  title = "Project settings",
}: Readonly<IProjectEditorPageProps>) {
  const { appId } = useParams();
  const projectQuery = useProject(appId);
  const componentsQuery = useProjectComponents(appId);
  const workflowQuery = useProjectWorkflow(appId);
  const registryQuery = useComponentRegistry();
  const updateProjectMutation = useUpdateProject();
  const replaceComponentsMutation = useReplaceProjectComponents();
  const replaceWorkflowMutation = useReplaceProjectWorkflow();
  const previewMutation = useGenerateProjectPreview();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [components, setComponents] = useState<IProjectComponent[]>([]);
  const [hasLoadedComponents, setHasLoadedComponents] = useState(false);
  const [workflow, setWorkflow] = useState<IProjectWorkflowDefinition>({
    version: 1,
    workflows: [],
  });
  const [hasLoadedWorkflow, setHasLoadedWorkflow] = useState(false);
  const [activeEditorSection, setActiveEditorSection] =
    useState<ProjectEditorSection>("components");
  const [hasOpenedWorkflows, setHasOpenedWorkflows] = useState(false);
  const [isCustomModulesDirty, setCustomModulesDirty] = useState(false);
  const project = projectQuery.data;
  const componentsDocument = componentsQuery.data;
  const workflowDocument = workflowQuery.data;
  const canEdit =
    project?.callerRole === "owner" ||
    project?.callerRole === "editor" ||
    project?.callerRole === "installationAdmin";
  const canManageCollaborators =
    project?.callerRole === "owner" ||
    project?.callerRole === "installationAdmin";
  const normalizedDescription = description.trim() || null;
  const isMetadataDirty = Boolean(
    project &&
      (name !== project.name || normalizedDescription !== project.description),
  );
  const isComponentsDirty = Boolean(
    componentsDocument &&
      hasLoadedComponents &&
      JSON.stringify(components) !== JSON.stringify(componentsDocument.components),
  );
  const isWorkflowDirty = Boolean(
    workflowDocument &&
      hasLoadedWorkflow &&
      JSON.stringify(workflow) !== JSON.stringify(workflowDocument.workflow),
  );
  const isDirty = isMetadataDirty || isComponentsDirty || isWorkflowDirty || isCustomModulesDirty;
  const navigationBlocker = useBlocker(
    isDirty &&
      !updateProjectMutation.isPending &&
      !replaceComponentsMutation.isPending &&
      !replaceWorkflowMutation.isPending,
  );

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
  }, [project]);

  useEffect(() => {
    if (componentsDocument && (!hasLoadedComponents || !isComponentsDirty)) {
      setComponents(componentsDocument.components);
      setHasLoadedComponents(true);
    }
  }, [componentsDocument, hasLoadedComponents, isComponentsDirty]);

  useEffect(() => {
    if (workflowDocument && (!hasLoadedWorkflow || !isWorkflowDirty)) {
      setWorkflow(workflowDocument.workflow);
      setHasLoadedWorkflow(true);
    }
  }, [workflowDocument, hasLoadedWorkflow, isWorkflowDirty]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function preventUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [isDirty]);

  async function handleSave() {
    if (!project || !canEdit) {
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        id: project.id,
        name,
        description: normalizedDescription,
        version: project.version,
      });
    } catch {
      // The mutation state renders the safe API error below.
    }
  }

  async function handleReloadMetadata() {
    updateProjectMutation.reset();
    const refreshedProject = await projectQuery.refetch();
    if (refreshedProject.data) {
      setName(refreshedProject.data.name);
      setDescription(refreshedProject.data.description ?? "");
    }
  }

  async function handleSaveComponents() {
    if (!project || !componentsDocument || !canEdit || isMetadataDirty) {
      return;
    }

    try {
      await replaceComponentsMutation.mutateAsync({
        projectId: project.id,
        version: componentsDocument.version,
        components,
      });
    } catch {
      // The mutation state renders the safe API error below.
    }
  }

  async function handlePreview() {
    if (!project || !canEdit) {
      return;
    }

    try {
      await previewMutation.mutateAsync(project.id);
    } catch {
      // The mutation state renders the safe API error below.
    }
  }

  async function handleReloadComponents() {
    replaceComponentsMutation.reset();
    previewMutation.reset();
    const refreshedDocument = await componentsQuery.refetch();
    if (refreshedDocument.data) {
      setComponents(refreshedDocument.data.components);
    }
  }

  async function handleSaveWorkflow() {
    if (!workflowDocument || !canEdit || isMetadataDirty) {
      return;
    }

    try {
      await replaceWorkflowMutation.mutateAsync({
        projectId: workflowDocument.projectId,
        version: workflowDocument.version,
        workflow,
      });
    } catch {
      // The mutation state renders the safe API error and reload action.
    }
  }

  async function handleReloadWorkflow() {
    replaceWorkflowMutation.reset();
    const refreshedDocument = await workflowQuery.refetch();
    if (refreshedDocument.data) {
      setWorkflow(refreshedDocument.data.workflow);
    }
  }

  function handleComponentsChange(nextComponents: IProjectComponent[]) {
    setComponents(nextComponents);
    previewMutation.reset();
  }

  function handleEditorSectionChange(section: ProjectEditorSection) {
    if (section === "workflows") setHasOpenedWorkflows(true);
    setActiveEditorSection(section);
  }

  if (projectQuery.isPending) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <p role="status" aria-live="polite">
          Loading project…
        </p>
      </main>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Project unavailable</h1>
        <p role="alert">
          {projectQuery.error instanceof Error
            ? projectQuery.error.message
            : "The project could not be loaded."}
        </p>
        <Button variant="outline" asChild>
          <Link to="/apps">Back to projects</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link className="underline-offset-4 hover:underline" to="/apps">
              Projects
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {title}: {project.name}
          </h1>
        </div>
        <span className="text-sm text-muted-foreground">
          Version {project.version} · {project.callerRole}
        </span>
      </header>

      {!canEdit && (
        <p role="status" className="rounded-md border border-border p-3 text-sm">
          You have read-only access to this project.
        </p>
      )}

      <ProjectMetadataEditor
        name={name}
        description={description}
        canEdit={canEdit}
        isDirty={isMetadataDirty}
        isDisabled={
          replaceComponentsMutation.isPending ||
          replaceWorkflowMutation.isPending ||
          isComponentsDirty ||
          isWorkflowDirty ||
          isCustomModulesDirty
        }
        isSaving={updateProjectMutation.isPending}
        isSaved={updateProjectMutation.isSuccess && !isMetadataDirty}
        errorMessage={
          updateProjectMutation.isError
            ? updateProjectMutation.error instanceof Error
              ? updateProjectMutation.error.message
              : "The project could not be saved."
            : null
        }
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onSave={() => void handleSave()}
        onReload={() => void handleReloadMetadata()}
      />

      <nav aria-label="Project editor sections" className="flex gap-2">
        <Button
          type="button"
          aria-pressed={activeEditorSection === "components"}
          variant={activeEditorSection === "components" ? "default" : "outline"}
          onClick={() => handleEditorSectionChange("components")}
        >
          App components
        </Button>
        <Button
          type="button"
          aria-pressed={activeEditorSection === "workflows"}
          variant={activeEditorSection === "workflows" ? "default" : "outline"}
          onClick={() => handleEditorSectionChange("workflows")}
        >
          Workflows
        </Button>
        {canManageCollaborators && (
          <Button
            type="button"
            aria-pressed={activeEditorSection === "collaborators"}
            variant={activeEditorSection === "collaborators" ? "default" : "outline"}
            onClick={() => handleEditorSectionChange("collaborators")}
          >
            Project access
          </Button>
        )}
      </nav>

      {canManageCollaborators && activeEditorSection === "collaborators" && (
        <ProjectCollaboratorsEditor projectId={project.id} />
      )}

      <section hidden={activeEditorSection !== "components"}>
      {componentsQuery.isPending && (
        <p role="status" aria-live="polite">
          Loading components…
        </p>
      )}
      {componentsQuery.isError && (
        <div role="alert" className="grid gap-2">
          <p>
            {componentsQuery.error instanceof Error
              ? componentsQuery.error.message
              : "Project components could not be loaded."}
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void componentsQuery.refetch()}
            >
              Retry loading components
            </Button>
          </div>
        </div>
      )}
      {componentsDocument && (
        <ProjectComponentsEditor
          components={components}
          isDirty={isComponentsDirty}
          isSaving={replaceComponentsMutation.isPending}
          isDisabled={
            !canEdit ||
            isMetadataDirty ||
            replaceComponentsMutation.isPending ||
            replaceWorkflowMutation.isPending ||
            updateProjectMutation.isPending
          }
          saveError={
            replaceComponentsMutation.isError
              ? replaceComponentsMutation.error instanceof Error
                ? replaceComponentsMutation.error.message
                : "The components could not be saved."
              : null
          }
          preview={previewMutation.data ?? null}
          isPreviewing={previewMutation.isPending}
          previewError={
            previewMutation.isError
              ? previewMutation.error instanceof Error
                ? previewMutation.error.message
                : "The preview could not be generated."
              : null
          }
          onComponentsChange={handleComponentsChange}
          onSave={() => void handleSaveComponents()}
          onReload={() => void handleReloadComponents()}
          onPreview={() => void handlePreview()}
        />
      )}
      </section>

      {hasOpenedWorkflows && (
      <section hidden={activeEditorSection !== "workflows"}>
      {workflowQuery.isPending && (
        <p role="status" aria-live="polite">
          Loading workflows…
        </p>
      )}
      {workflowQuery.isError && (
        <div role="alert" className="grid gap-2">
          <p>
            {workflowQuery.error instanceof Error
              ? workflowQuery.error.message
              : "Project workflows could not be loaded."}
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void workflowQuery.refetch()}
            >
              Retry loading workflows
            </Button>
          </div>
        </div>
      )}
      {workflowDocument && componentsDocument && registryQuery.data && (
        <ProjectWorkflowEditor
          projectId={project.id}
          version={workflowDocument.version}
          components={components}
          definitions={registryQuery.data.components}
          workflow={workflow}
          onComponentsChange={handleComponentsChange}
          isDirty={isWorkflowDirty}
          isSaving={replaceWorkflowMutation.isPending}
          isDisabled={
            !canEdit ||
            isMetadataDirty ||
            updateProjectMutation.isPending ||
            replaceComponentsMutation.isPending ||
            replaceWorkflowMutation.isPending
          }
          saveError={
            replaceWorkflowMutation.isError
              ? replaceWorkflowMutation.error instanceof Error
                ? replaceWorkflowMutation.error.message
                : "The workflows could not be saved."
              : null
          }
          onWorkflowChange={setWorkflow}
          onSave={() => void handleSaveWorkflow()}
          onReload={() => void handleReloadWorkflow()}
          onCustomModulesDirtyChange={setCustomModulesDirty}
        />
      )}
      {registryQuery.isError && (
        <p role="alert">
          {registryQuery.error instanceof Error
            ? registryQuery.error.message
            : "The component registry could not be loaded for workflow editing."}
        </p>
      )}
      </section>
      )}

      {navigationBlocker.state === "blocked" && (
        <section
          aria-labelledby="unsaved-heading"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="alertdialog"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 id="unsaved-heading" className="text-lg font-semibold">
              Discard unsaved changes?
            </h2>
            <p className="text-sm text-muted-foreground">
              Your project edits have not been saved.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigationBlocker.reset()}
              >
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => navigationBlocker.proceed()}
              >
                Discard changes
              </Button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default ProjectEditorPage;
