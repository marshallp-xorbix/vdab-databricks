import type { FC, ReactNode } from "react";
import { useState, useEffect } from "react";
import { PropertyEditorFactory } from "../../properties";
import { BindingsPanel } from "../../properties/BindingsPanel";
import { AmoebaStoryFieldMappingsPanel } from "../../properties/AmoebaStoryFieldMappingsPanel";
import { NetworkWebStoryFieldMappingsPanel } from "../../properties/NetworkWebStoryFieldMappingsPanel";
import { TerrainStoryFieldMappingsPanel } from "../../properties/TerrainStoryFieldMappingsPanel";
import { HeatMapStoryFieldMappingsPanel } from "../../properties/HeatMapStoryFieldMappingsPanel";
import { PulseWaveStoryFieldMappingsPanel } from "../../properties/PulseWaveStoryFieldMappingsPanel";
import { FlowFieldStoryFieldMappingsPanel } from "../../properties/FlowFieldStoryFieldMappingsPanel";
import { HoneycombStoryFieldMappingsPanel } from "../../properties/HoneycombStoryFieldMappingsPanel";
import { SpiralStoryFieldMappingsPanel } from "../../properties/SpiralStoryFieldMappingsPanel";
import { ComponentWorkflowsPanel } from "../../properties/ComponentWorkflowsPanel";
import {
  getCodeNameInputValidationError,
  MAX_CODE_NAME_LENGTH,
  normalizeCodeName,
} from "../../../utils/codeNameUtils";
import {
  getComponentPropertyErrors,
} from "../../../utils/componentProps/componentPropsValidationUtils";
import type { VdabComponent } from "../../../types/components";
import {
  ComponentType,
  humanizeComponentType,
} from "../../../types/components/componentTypes";
import type { Binding } from "../../../types/components/bindings";
import {
  EMPTY_WORKFLOW_DEFINITION,
  type WorkflowDefinition,
} from "../../../types/workflow";
import { getWorkflowBindingOverridesForComponent } from "../../../utils/workflow/workflowBindingOverrides";
import CollapsibleSection from "./CollapsibleSection";
import PagePropertiesPanel from "./PagePropertiesPanel";
import { StoryVisualizationHelpLink } from "../../properties/StoryVisualizationHelpLink";
import type { NormalizedAppResource } from "../../../models/DatabricksAppModels";
import { CanvasContextType } from "../../../types/editor";
import ProjectComponentPropertiesEditor, {
  type IProjectComponentPropertiesEditorProps,
} from "../../ProjectComponentPropertiesEditor";

const STORY_FIELD_MAPPING_PANELS: Partial<
  Record<
    ComponentType,
    FC<{
      component: VdabComponent;
      onPropertyChange: (key: string, value: unknown) => void;
    }>
  >
> = {
  [ComponentType.AmoebaStory]: AmoebaStoryFieldMappingsPanel,
  [ComponentType.NetworkWebStory]: NetworkWebStoryFieldMappingsPanel,
  [ComponentType.HeatMapStory]: HeatMapStoryFieldMappingsPanel,
  [ComponentType.PulseWaveStory]: PulseWaveStoryFieldMappingsPanel,
  [ComponentType.FlowFieldStory]: FlowFieldStoryFieldMappingsPanel,
  [ComponentType.HoneycombStory]: HoneycombStoryFieldMappingsPanel,
  [ComponentType.SpiralStory]: SpiralStoryFieldMappingsPanel,
  [ComponentType.TerrainStory]: TerrainStoryFieldMappingsPanel,
};

type ComponentPropertyMap = Record<string, unknown>;

interface PropertiesPanelProps {
  selectedComponent: VdabComponent | null;
  components: VdabComponent[]; // All components in the app
  onUpdateComponent: (
    componentId: string,
    newProperties: ComponentPropertyMap,
  ) => void;
  onUpdateBindings?: (
    componentId: string,
    bindings: Record<string, Binding>,
  ) => void;
  workflowDefinition?: WorkflowDefinition;
  customModulesCode?: string;
  prebuiltModulesLibrarySource?: string;
  onWorkflowDefinitionChange?: (nextDefinition: WorkflowDefinition) => void;
  onJumpToWorkflowAction?: (workflowCodeName: string, nodeId?: string) => void;
  onDeleteTab?: (componentId: string, tabIndex: number) => void;
  onClose: () => void;
  workspaceConnectionId?: number;
  /** Resolved workspace URL for dashboard embed validation in the property editor. */
  workspaceUrl?: string | null;
  /** App Settings resources (for Genie Chat binding dropdown). */
  normalizedAppResources?: NormalizedAppResource[];
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
  onUpdateBindings,
  workflowDefinition = EMPTY_WORKFLOW_DEFINITION,
  customModulesCode = "",
  prebuiltModulesLibrarySource = "",
  onWorkflowDefinitionChange,
  onJumpToWorkflowAction,
  onDeleteTab,
  onClose,
  workspaceConnectionId,
  workspaceUrl = null,
  normalizedAppResources = [],
  disableScroll = false,
  canvasContextType = CanvasContextType.Page,
  pageWidth,
  onPageWidthChange,
  projectComponentEditor,
  projectComponentTreeActions,
}) => {
  const [properties, setProperties] = useState<ComponentPropertyMap>({});
  const [propertyErrors, setPropertyErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [codeNameDrafts, setCodeNameDrafts] = useState<Record<string, string>>(
    {},
  );
  const [codeNameErrors, setCodeNameErrors] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    if (selectedComponent) {
      setProperties({ ...selectedComponent.props });
      setPropertyErrors(getComponentPropertyErrors(selectedComponent));
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

  const handlePropertyChange = (key: string, value: unknown) => {
    if (!selectedComponent) return;
    const updatedProperties = { ...properties, [key]: value };
    setProperties(updatedProperties);
    onUpdateComponent(selectedComponent.id, updatedProperties);

    const updatedComponent = {
      ...selectedComponent,
      props: updatedProperties,
    };
    // TODO: block save + deploy on issues
    setPropertyErrors(
      getComponentPropertyErrors(updatedComponent),
    );
  };

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

  const handleBindingsChange = (bindings: Record<string, Binding>) => {
    if (!selectedComponent || !onUpdateBindings) return;
    onUpdateBindings(selectedComponent.id, bindings);
  };

  const renderPropertyEditor = () => {
    if (!selectedComponent) return null;

    if (projectComponentEditor) {
      return <ProjectComponentPropertiesEditor {...projectComponentEditor} />;
    }

    return (
      <PropertyEditorFactory
        component={selectedComponent}
        components={components}
        propertyErrors={propertyErrors}
        onPropertyChange={handlePropertyChange}
        onDeleteTab={onDeleteTab}
        workspaceUrl={workspaceUrl}
        normalizedAppResources={normalizedAppResources}
      />
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
  const workflowBindingOverrides = selectedComponent
    ? getWorkflowBindingOverridesForComponent(
        workflowDefinition,
        selectedComponent.codeName,
        components,
      )
    : [];
  const hasBindingsSection = Boolean(
    selectedComponent?.supportedBindings &&
      selectedComponent.supportedBindings.length > 0 &&
      !projectComponentEditor,
  );
  const hasStoryFieldMappings =
    selectedComponent != null &&
    selectedComponent.type in STORY_FIELD_MAPPING_PANELS &&
    !projectComponentEditor;
  const StoryFieldMappingsPanel = selectedComponent
    ? STORY_FIELD_MAPPING_PANELS[selectedComponent.type]
    : undefined;

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
        titleAccessory={
          hasStoryFieldMappings ? <StoryVisualizationHelpLink /> : undefined
        }
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

            {!hasBindingsSection && (
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
                      workspaceConnectionId={workspaceConnectionId}
                      normalizedAppResources={normalizedAppResources}
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
            )}

            {/* BINDINGS section — only rendered when component declares supported bindings */}
            {hasBindingsSection && (
                <div className="rounded-lg border border-[var(--builder-chrome-border)] bg-[var(--builder-panel-bg)] px-1 py-2 shadow-sm">
                  <div className="flex items-center gap-2 px-3 pb-1 pt-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Bindings
                    </span>
                    <div className="flex-1 h-px bg-muted" />
                  </div>

                  <div className="px-3 pb-3" data-property-nested-fields>
                    <BindingsPanel
                      component={selectedComponent}
                      onUpdateBindings={handleBindingsChange}
                      workflowBindingOverrides={workflowBindingOverrides}
                      onJumpToWorkflowAction={onJumpToWorkflowAction}
                      workspaceConnectionId={workspaceConnectionId}
                    />
                  </div>
                </div>
              )}

            {/* FIELD MAPPINGS — story visuals; sits below Bindings so columns are available */}
            {hasStoryFieldMappings && (
              <div className="rounded-lg border border-[var(--builder-chrome-border)] bg-[var(--builder-panel-bg)] px-1 py-2 shadow-sm">
                <div className="flex items-center gap-2 px-3 pb-1 pt-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Field Mappings
                  </span>
                  <div className="flex-1 h-px bg-muted" />
                </div>

                <div className="px-3 pb-3" data-property-nested-fields>
                  {StoryFieldMappingsPanel && (
                    <StoryFieldMappingsPanel
                      component={selectedComponent}
                      onPropertyChange={handlePropertyChange}
                    />
                  )}
                </div>
              </div>
            )}

            {hasBindingsSection && (
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
                      workspaceConnectionId={workspaceConnectionId}
                      normalizedAppResources={normalizedAppResources}
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
            )}
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
