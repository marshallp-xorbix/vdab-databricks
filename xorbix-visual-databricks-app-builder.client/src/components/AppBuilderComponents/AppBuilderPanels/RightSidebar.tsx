import type { FC, ReactNode } from "react";
import PropertiesPanel from "./PropertiesPanel";
import type { VdabComponent } from "../../../types/components";
import type { Binding } from "../../../types/components/bindings";
import type { WorkflowDefinition } from "../../../types/workflow";
import type { NormalizedAppResource } from "../../../models/DatabricksAppModels";
import type { CanvasContextType } from "../../../types/editor";
import type { IProjectComponentPropertiesEditorProps } from "../../ProjectComponentPropertiesEditor";

interface RightSidebarProps {
  selectedComponent: VdabComponent | null;
  components: VdabComponent[];
  onUpdateComponent: (
    componentId: string,
    newProperties: Record<string, unknown>,
  ) => void;
  onDeleteTab?: (componentId: string, tabIndex: number) => void;
  onUpdateBindings?: (
    componentId: string,
    bindings: Record<string, Binding>,
  ) => void;
  workflowDefinition: WorkflowDefinition;
  customModulesCode?: string;
  prebuiltModulesLibrarySource?: string;
  onWorkflowDefinitionChange?: (nextDefinition: WorkflowDefinition) => void;
  onJumpToWorkflowAction?: (workflowCodeName: string, nodeId?: string) => void;
  onCloseProperties: () => void;
  workspaceConnectionId?: number;
  workspaceUrl?: string | null;
  normalizedAppResources?: NormalizedAppResource[];
  isDragActive?: boolean;
  canvasContextType?: CanvasContextType;
  pageWidth?: number;
  onPageWidthChange?: (pageWidth: number) => void;
  projectComponentEditor?: IProjectComponentPropertiesEditorProps;
  projectComponentTreeActions?: ReactNode;
}

const RightSidebar: FC<RightSidebarProps> = ({
  selectedComponent,
  components,
  onUpdateComponent,
  onDeleteTab,
  onUpdateBindings,
  workflowDefinition,
  customModulesCode,
  prebuiltModulesLibrarySource,
  onWorkflowDefinitionChange,
  onJumpToWorkflowAction,
  onCloseProperties,
  workspaceConnectionId,
  workspaceUrl = null,
  normalizedAppResources = [],
  isDragActive = false,
  canvasContextType,
  pageWidth,
  onPageWidthChange,
  projectComponentEditor,
  projectComponentTreeActions,
}) => {
  return (
    <aside className="builder-sidebar-surface builder-chrome-surface flex h-full w-80 flex-col overflow-hidden border-l border-[var(--builder-chrome-border)]">
      {/* Properties panel */}
      <div className="flex flex-col flex-1 min-h-0">
        <PropertiesPanel
          selectedComponent={selectedComponent}
          components={components}
          onUpdateComponent={onUpdateComponent}
          onDeleteTab={onDeleteTab}
          onUpdateBindings={onUpdateBindings}
          workflowDefinition={workflowDefinition}
          customModulesCode={customModulesCode}
          prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
          onWorkflowDefinitionChange={onWorkflowDefinitionChange}
          onJumpToWorkflowAction={onJumpToWorkflowAction}
          workspaceConnectionId={workspaceConnectionId}
          workspaceUrl={workspaceUrl}
          normalizedAppResources={normalizedAppResources}
          onClose={onCloseProperties}
          disableScroll={isDragActive}
          canvasContextType={canvasContextType}
          pageWidth={pageWidth}
          onPageWidthChange={onPageWidthChange}
          projectComponentEditor={projectComponentEditor}
          projectComponentTreeActions={projectComponentTreeActions}
        />
      </div>
    </aside>
  );
};

export default RightSidebar;
