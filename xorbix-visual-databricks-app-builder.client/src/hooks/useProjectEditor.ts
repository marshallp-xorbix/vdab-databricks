import { useEffect, useState } from "react";
import { useBlocker, useParams, useSearchParams } from "react-router-dom";
import { useProject } from "./useProject";
import { useProjectComponents } from "./useProjectComponents";
import { useReplaceProjectComponents } from "./useReplaceProjectComponents";
import { useProjectWorkflow } from "./useProjectWorkflow";
import { useReplaceProjectWorkflow } from "./useReplaceProjectWorkflow";
import { useComponentRegistry } from "./useComponentRegistry";
import { useGenerateProjectPreview } from "./useGenerateProjectPreview";
import { useUpdateProject } from "./useUpdateProject";
import { useProjectComponentsAutosave } from "./useProjectComponentsAutosave";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";

type ProjectEditorSection =
  | "components"
  | "workflows"
  | "code"
  | "settings"
  | "collaborators";

/** Owns project editor query state, drafts, and save/reload operations. */
export function useProjectEditor() {
  const { appId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [theme, setTheme] = useState<Record<string, unknown>>({});
  const [components, setComponents] = useState<IProjectComponent[]>([]);
  const [hasLoadedComponents, setHasLoadedComponents] = useState(false);
  const [workflow, setWorkflow] = useState<IProjectWorkflowDefinition>({
    version: 1,
    workflows: [],
  });
  const [hasLoadedWorkflow, setHasLoadedWorkflow] = useState(false);
  const [activeEditorSection, setActiveEditorSection] =
    useState<ProjectEditorSection>(() =>
      readEditorSection(searchParams.get("section")),
    );
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
  const isThemeDirty = Boolean(
    project && JSON.stringify(theme) !== JSON.stringify(project.theme ?? {}),
  );
  const isMetadataDirty = Boolean(
    project &&
    (name !== project.name || normalizedDescription !== project.description ||
      isThemeDirty),
  );
  const isComponentsDirty = Boolean(
    componentsDocument &&
    hasLoadedComponents &&
    JSON.stringify(components) !==
      JSON.stringify(componentsDocument.components),
  );
  const isWorkflowDirty = Boolean(
    workflowDocument &&
    hasLoadedWorkflow &&
    JSON.stringify(workflow) !== JSON.stringify(workflowDocument.workflow),
  );
  const isDirty =
    isMetadataDirty ||
    isComponentsDirty ||
    isWorkflowDirty ||
    isCustomModulesDirty;
  const navigationBlocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      currentLocation.pathname !== nextLocation.pathname &&
      !updateProjectMutation.isPending &&
      !replaceComponentsMutation.isPending &&
      !replaceWorkflowMutation.isPending,
  );

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setTheme(project.theme ?? {});
    }
  }, [project]);

  useEffect(() => {
    const section = readEditorSection(searchParams.get("section"));
    setActiveEditorSection(section);
    if (section === "workflows" || searchParams.get("tool") === "ai") {
      setHasOpenedWorkflows(true);
    }
  }, [searchParams]);

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
        ...(isThemeDirty ? { theme } : {}),
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
      setTheme(refreshedProject.data.theme ?? {});
    }
  }

  async function handleSaveComponents() {
    if (
      !project ||
      !componentsDocument ||
      !canEdit ||
      isMetadataDirty ||
      isWorkflowDirty ||
      isCustomModulesDirty
    ) {
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

  async function handleSaveWorkflow(): Promise<boolean> {
    if (!workflowDocument || !canEdit || isMetadataDirty) {
      return false;
    }

    try {
      await replaceWorkflowMutation.mutateAsync({
        projectId: workflowDocument.projectId,
        version: workflowDocument.version,
        workflow,
      });
      return true;
    } catch {
      // The mutation state renders the safe API error and reload action.
      return false;
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
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (section === "components") next.delete("section");
        else next.set("section", section);
        return next;
      },
      { replace: true },
    );
  }

  useProjectComponentsAutosave({
    draft: components,
    isDirty: isComponentsDirty,
    canSave: Boolean(
      project &&
      componentsDocument &&
      canEdit &&
      !isMetadataDirty &&
      !isWorkflowDirty &&
      !isCustomModulesDirty &&
      !updateProjectMutation.isPending &&
      !replaceWorkflowMutation.isPending,
    ),
    isSaving: replaceComponentsMutation.isPending,
    hasError: replaceComponentsMutation.isError,
    onSave: handleSaveComponents,
  });

  return {
    projectQuery,
    componentsQuery,
    workflowQuery,
    registryQuery,
    updateProjectMutation,
    replaceComponentsMutation,
    replaceWorkflowMutation,
    previewMutation,
    name,
    setName,
    description,
    setDescription,
    theme,
    setTheme,
    components,
    workflow,
    setWorkflow,
    activeEditorSection,
    hasLoadedWorkflow,
    hasOpenedWorkflows,
    isCustomModulesDirty,
    setCustomModulesDirty,
    project,
    componentsDocument,
    workflowDocument,
    canEdit,
    canManageCollaborators,
    isMetadataDirty,
    isThemeDirty,
    isComponentsDirty,
    isWorkflowDirty,
    isDirty,
    navigationBlocker,
    handleSave,
    handleReloadMetadata,
    handleSaveComponents,
    handlePreview,
    handleReloadComponents,
    handleSaveWorkflow,
    handleReloadWorkflow,
    handleComponentsChange,
    handleEditorSectionChange,
  };
}

function readEditorSection(value: string | null): ProjectEditorSection {
  return value === "workflows" ||
    value === "code" ||
    value === "settings" ||
    value === "collaborators"
    ? value
    : "components";
}
