import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { ComponentWorkflowsPanel } from "../../properties/ComponentWorkflowsPanel";
import {
  getCodeNameInputValidationError,
  MAX_CODE_NAME_LENGTH,
  normalizeCodeName,
} from "../../../utils/codeNameUtils";
import type { VdabComponent } from "../../../types/components";
import { humanizeComponentType } from "../../../types/components/componentTypes";
import {
  EMPTY_WORKFLOW_DEFINITION,
  type WorkflowDefinition,
} from "../../../types/workflow";
import CollapsibleSection from "./CollapsibleSection";
import PagePropertiesPanel from "./PagePropertiesPanel";
import { CanvasContextType } from "../../../types/editor";
import ProjectComponentPropertiesEditor, {
  type IProjectComponentPropertiesEditorProps,
} from "../../ProjectComponentPropertiesEditor";

interface PropertiesPanelProps {
  selectedComponent: VdabComponent | null;
  components: VdabComponent[]; // All components in the app
  onUpdateComponent: (
    componentId: string,
    newProperties: Record<string, unknown>,
  ) => void;
  workflowDefinition?: WorkflowDefinition;
  customModulesCode?: string;
  prebuiltModulesLibrarySource?: string;
  onWorkflowDefinitionChange?: (nextDefinition: WorkflowDefinition) => void;
  onJumpToWorkflowAction?: (workflowCodeName: string, nodeId?: string) => void;
  onClose: () => void;
  disableScroll?: boolean;
  /** Active canvas context; page properties show when Main Page has no selection. */
  canvasContextType?: CanvasContextType;
  pageWidth?: number;
  onPageWidthChange?: (pageWidth: number) => void;
  projectComponentEditor?: IProjectComponentPropertiesEditorProps;
  projectComponentTreeActions?: ReactNode;
}

const PropertiesPanel: FC<PropertiesPanelProps> = ({
  selectedComponent,
  components,
  onUpdateComponent,
  workflowDefinition = EMPTY_WORKFLOW_DEFINITION,
  customModulesCode = "",
  prebuiltModulesLibrarySource = "",
  onWorkflowDefinitionChange,
  onJumpToWorkflowAction,
  onClose,
  disableScroll = false,
  canvasContextType = CanvasContextType.Page,
  pageWidth,
  onPageWidthChange,
  projectComponentEditor,
  projectComponentTreeActions,
}) => {
  const [codeNameDrafts, setCodeNameDrafts] = useState<Record<string, string>>(
    {},
  );
  const [codeNameErrors, setCodeNameErrors] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    if (selectedComponent) {
      setCodeNameDrafts((prev) => {
        if (prev[selectedComponent.id] !== undefined) {
          return prev;
        }

        return {
          ...prev,
          [selectedComponent.id]: selectedComponent.codeName ?? "",
        };
      });
    }
  }, [selectedComponent]);

  const handleCodeNameChange = (value: string) => {
    if (!selectedComponent) return;

    setCodeNameDrafts((prev) => ({
      ...prev,
      [selectedComponent.id]: value,
    }));

    const validationError = getCodeNameInputValidationError(
      value,
      selectedComponent.id,
      components,
    );

    setCodeNameErrors((prev) => ({
      ...prev,
      [selectedComponent.id]: validationError,
    }));

    if (validationError) {
      return;
    }

    const normalizedCodeName = normalizeCodeName(value);
    onUpdateComponent(selectedComponent.id, { codeName: normalizedCodeName });

    setCodeNameDrafts((prev) => ({
      ...prev,
      [selectedComponent.id]: normalizedCodeName ?? "",
    }));
  };

  const renderPropertyEditor = () => {
    if (!selectedComponent) return null;

    if (projectComponentEditor) {
      return <ProjectComponentPropertiesEditor {...projectComponentEditor} />;
    }

    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 p-3 text-sm"
      >
        The project component editor is unavailable.
      </p>
    );
  };

  const selectedCodeName = selectedComponent
    ? (codeNameDrafts[selectedComponent.id] ?? selectedComponent.codeName ?? "")
    : "";
  const selectedCodeNameError = selectedComponent
    ? codeNameErrors[selectedComponent.id]
    : undefined;
  const codeNameInputId = selectedComponent
    ? `code-name-${selectedComponent.id}`
    : "code-name";
  const showPageProperties =
    !selectedComponent &&
    canvasContextType === CanvasContextType.Page &&
    pageWidth !== undefined &&
    onPageWidthChange !== undefined;

  let panelTitle = "Properties";
  if (selectedComponent) {
    panelTitle = `${humanizeComponentType(selectedComponent.type)} Properties`;
  } else if (showPageProperties) {
    panelTitle = "Page Properties";
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <CollapsibleSection
        title={panelTitle}
        panelTone="sidebarBlue"
        sidebarTitleRole="panel"
        disableContentScroll={disableScroll}
        collapsible={false}
        headerActions={
          selectedComponent && (
            <button
              onClick={onClose}
              className="text-lg leading-none text-[var(--builder-chrome-foreground-muted)] hover:text-[var(--builder-chrome-foreground)]"
            >
              ×
            </button>
          )
        }
      >
        {selectedComponent ? (
          <div className="mx-2 mb-2 space-y-2">
            {projectComponentTreeActions && (
              <div className="rounded-lg border border-[var(--builder-chrome-border)] bg-[var(--builder-panel-bg)] p-2 shadow-sm">
                {projectComponentTreeActions}
              </div>
            )}
            <div className="rounded-lg border border-[var(--builder-chrome-border)] bg-[var(--builder-panel-bg)] px-1 py-2 shadow-sm">
              {/* GENERAL section */}
              <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  General
                </span>
                <div className="flex-1 h-px bg-muted" />
              </div>

              <div
                className="px-3 space-y-2 pb-3"
                data-property-nested-fields
              >
                {/* Code Name */}
                <div>
                  <label
                    htmlFor={codeNameInputId}
                    className="block text-xs font-medium text-muted-foreground mb-0.5"
                  >
                    Code Name
                  </label>
                  <input
                    id={codeNameInputId}
                    type="text"
                    value={selectedCodeName}
                    placeholder="Enter code name..."
                    onChange={(event) =>
                      handleCodeNameChange(event.target.value)
                    }
                    className={`w-full px-2 py-1.5 text-sm border rounded-md bg-card focus:outline-none focus:ring-2 focus:border-primary ${
                      selectedCodeNameError
                        ? "border-destructive focus:ring-destructive"
                        : "border-border focus:ring-primary"
                    }`}
                  />
                  <p
                    className={`text-xs mt-0.5 ${
                      selectedCodeNameError ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {selectedCodeNameError ??
                      `Required. Max ${MAX_CODE_NAME_LENGTH} characters.`}
                  </p>
                </div>

                {/* Component-specific properties */}
                {renderPropertyEditor()}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--builder-chrome-border)] bg-[var(--builder-panel-bg)] px-1 py-2 shadow-sm">
              <div className="flex items-center gap-2 px-3 pb-1 pt-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Workflows
                </span>
                <div className="flex-1 h-px bg-muted" />
              </div>

              <div className="px-3 pb-3" data-property-nested-fields>
                {onWorkflowDefinitionChange ? (
                  <ComponentWorkflowsPanel
                    component={selectedComponent}
                    components={components}
                    workflowDefinition={workflowDefinition}
                    customModulesCode={customModulesCode}
                    prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
                    onWorkflowDefinitionChange={onWorkflowDefinitionChange}
                    onJumpToWorkflowAction={onJumpToWorkflowAction}
                  />
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">
                    Workflow editing is unavailable.
                  </p>
                )}
              </div>
              </div>
          </div>
        ) : (
          <>
            {showPageProperties &&
            pageWidth !== undefined &&
            onPageWidthChange !== undefined ? (
              <PagePropertiesPanel
                pageWidth={pageWidth}
                onPageWidthChange={onPageWidthChange}
              />
            ) : (
              <div className="px-3 pb-3 pt-2 text-sm text-[var(--builder-chrome-foreground)]">
                Select a component to edit its properties
              </div>
            )}
          </>
        )}
      </CollapsibleSection>
    </div>
  );
};

export default PropertiesPanel;
