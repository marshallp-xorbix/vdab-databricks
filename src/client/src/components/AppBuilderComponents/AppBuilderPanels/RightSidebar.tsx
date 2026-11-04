import type { FC, ReactNode } from "react";
import PropertiesPanel from "./PropertiesPanel";
import type { VdabComponent } from "../../../types/components";
import type { WorkflowDefinition } from "../../../types/workflow";
import type { CanvasContextType } from "../../../types/editor";
import type { IProjectComponentPropertiesEditorProps } from "../../ProjectComponentPropertiesEditor";

interface RightSidebarProps {
  selectedComponent: VdabComponent | null;
  components: VdabComponent[];
  onUpdateComponent: (
    componentId: string,
    newProperties: Record<string, unknown>,
  ) => void;
  workflowDefinition: WorkflowDefinition;
  customModulesCode?: string;
  prebuiltModulesLibrarySource?: string;
  onWorkflowDefinitionChange?: (nextDefinition: WorkflowDefinition) => void;
  onJumpToWorkflowAction?: (workflowCodeName: string, nodeId?: string) => void;
  onCloseProperties: () => void;
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
  workflowDefinition,
  customModulesCode,
  prebuiltModulesLibrarySource,
  onWorkflowDefinitionChange,
  onJumpToWorkflowAction,
  onCloseProperties,
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
          workflowDefinition={workflowDefinition}
          customModulesCode={customModulesCode}
          prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
          onWorkflowDefinitionChange={onWorkflowDefinitionChange}
          onJumpToWorkflowAction={onJumpToWorkflowAction}
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
