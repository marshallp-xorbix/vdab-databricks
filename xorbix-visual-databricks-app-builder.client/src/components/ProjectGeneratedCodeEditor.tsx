import { useEffect, useState } from "react";
import type { ICodePreviewFile } from "../models";
import type { IProjectPreview } from "../models/ProjectComponents";
import CodeTabView from "./AppBuilderComponents/AppCanvas/CodeTabView";
import { Button } from "./ui/button";
import { useProjectCustomModules } from "../hooks/useProjectCustomModules";
import { useReplaceProjectCustomModules } from "../hooks/useReplaceProjectCustomModules";
import { PREBUILT_MODULES_LIBRARY_SOURCE } from "../utils/prebuiltModulesLibrarySource";
import { chooseDefaultCodeFilePath } from "../utils/codePreviewUtils";

interface IProjectGeneratedCodeEditorProps {
  projectId: string;
  preview: IProjectPreview | null;
  isPending: boolean;
  errorMessage: string | null;
  isDisabled: boolean;
  onGenerate: () => void;
  onCustomModulesDirtyChange: (isDirty: boolean) => void;
  customModulesSource: string;
  hasLoadedCustomModulesSource: boolean;
  onCustomModulesSourceChange: (source: string) => void;
}

/** Reuses the SaaS file tree and Monaco editor with standalone project persistence. */
function ProjectGeneratedCodeEditor({
  projectId,
  preview,
  isPending,
  errorMessage,
  isDisabled,
  onGenerate,
  onCustomModulesDirtyChange,
  customModulesSource,
  hasLoadedCustomModulesSource,
  onCustomModulesSourceChange,
}: Readonly<IProjectGeneratedCodeEditorProps>) {
  const customModulesQuery = useProjectCustomModules(projectId);
  const replaceCustomModulesMutation = useReplaceProjectCustomModules();
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const customModulesDocument = customModulesQuery.data;
  const isCustomModulesDirty = Boolean(
    customModulesDocument &&
      loadedProjectId === projectId &&
      customModulesSource !== customModulesDocument.source,
  );
  const previewFiles = preview?.files ?? [];
  const files: ICodePreviewFile[] =
    customModulesDocument &&
    !previewFiles.some((file) => file.path === "custom_modules.py")
      ? [
          ...previewFiles,
          {
            path: "custom_modules.py",
            content:
              loadedProjectId === projectId
                ? customModulesSource
                : customModulesDocument.source,
          },
        ]
      : previewFiles;

  useEffect(() => {
    if (customModulesDocument?.projectId === projectId && loadedProjectId !== projectId) {
      if (!hasLoadedCustomModulesSource) {
        onCustomModulesSourceChange(customModulesDocument.source);
      }
      setLoadedProjectId(projectId);
    }
  }, [
    customModulesDocument,
    hasLoadedCustomModulesSource,
    loadedProjectId,
    onCustomModulesSourceChange,
    projectId,
  ]);

  useEffect(() => {
    onCustomModulesDirtyChange(isCustomModulesDirty);
  }, [isCustomModulesDirty, onCustomModulesDirtyChange]);

  useEffect(() => {
    if (preview && !selectedFilePath) {
      setSelectedFilePath(chooseDefaultCodeFilePath(files));
    }
  }, [files, preview, selectedFilePath]);

  useEffect(() => {
    if (!preview && !isPending && !errorMessage) onGenerate();
  }, [errorMessage, isPending, onGenerate, preview]);

  async function handleSaveCustomModules() {
    if (!customModulesDocument || isDisabled || !isCustomModulesDirty) return;
    try {
      const saved = await replaceCustomModulesMutation.mutateAsync({
        projectId,
        version: customModulesDocument.version,
        source: customModulesSource,
      });
      onCustomModulesSourceChange(saved.source);
      setLoadedProjectId(projectId);
      onCustomModulesDirtyChange(false);
    } catch {
      // The mutation state below exposes the safe API failure and retry action.
    }
  }

  function handleToggleDirectory(directoryPath: string, isOpen: boolean) {
    setOpenState((current) => ({ ...current, [directoryPath]: isOpen }));
  }

  return (
    <section aria-label="Code editor" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 justify-end border-b border-[var(--builder-chrome-border)] px-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDisabled || !isCustomModulesDirty || customModulesQuery.isPending || replaceCustomModulesMutation.isPending}
          onClick={() => void handleSaveCustomModules()}
        >
          {replaceCustomModulesMutation.isPending ? "Saving…" : "Save custom modules"}
        </Button>
      </div>
      {errorMessage && <p role="alert" className="sr-only">{errorMessage}</p>}
      {replaceCustomModulesMutation.isError && (
        <p role="alert" className="sr-only">
          {replaceCustomModulesMutation.error instanceof Error
            ? replaceCustomModulesMutation.error.message
            : "Custom Python modules could not be saved."}
        </p>
      )}
      {customModulesQuery.isError && (
        <p role="alert" className="sr-only">
          {customModulesQuery.error instanceof Error
            ? customModulesQuery.error.message
            : "Custom Python modules could not be loaded."}
        </p>
      )}
      {customModulesQuery.isPending && <p role="status" className="sr-only">Loading custom modules…</p>}
      {isCustomModulesDirty && <p role="status" className="sr-only">Custom Python changes are not saved.</p>}
      <div className="min-h-0 flex-1">
        <CodeTabView
          files={files}
          selectedFilePath={selectedFilePath}
          loading={isPending || customModulesQuery.isPending}
          onSelectFile={setSelectedFilePath}
          openState={openState}
          onToggleDirectory={handleToggleDirectory}
          customModulesCode={customModulesSource}
          onCustomModulesCodeChange={onCustomModulesSourceChange}
          prebuiltModulesLibrarySource={PREBUILT_MODULES_LIBRARY_SOURCE}
          appMetaLoading={customModulesQuery.isPending || loadedProjectId !== projectId}
          previewErrors={[]}
          readOnly={isDisabled}
        />
      </div>
    </section>
  );
}

export default ProjectGeneratedCodeEditor;
