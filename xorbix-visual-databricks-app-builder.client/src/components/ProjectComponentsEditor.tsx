import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import MainFlowView from "./AppBuilderComponents/AppCanvas/MainFlowView";
import BuilderLeftPanel from "./AppBuilderComponents/AppBuilderPanels/BuilderLeftPanel";
import type {
  IComponentDefinition,
  IProjectComponent,
} from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import { useProjectComponentEditor } from "../hooks/useProjectComponentEditor";
import { toWorkflowBuilderDefinition } from "../utils/projectWorkflowContractAdapter";
import AppCanvasArea from "./AppBuilderComponents/AppCanvas/AppCanvasArea";
import RightSidebar from "./AppBuilderComponents/AppBuilderPanels/RightSidebar";
import { useProjectLegacyCanvas } from "../hooks/useProjectLegacyCanvas";
import TabBar from "./AppBuilderComponents/TabBar";
import { CanvasContextType, TabType } from "../types/editor";
import { useTabManagement } from "../hooks/useTabManagement";
import { toCanvasComponents } from "../utils/projectCanvasAdapter";
import { getPageWidthFromTheme } from "../utils/pageWidthDefaults";
import type { IProjectComponentPropertiesEditorProps } from "./ProjectComponentPropertiesEditor";
import ProjectComponentTreeActions from "./ProjectComponentTreeActions";
import { useTheme } from "../context/ThemeContext";
import { getStreamlitThemeDefaults } from "./AppBuilderComponents/AppSettingsTab/themeDefaults";
import type { ComponentDragData } from "../types/dnd";
import { readComponentDragData } from "../utils/dndPayload";
import { nestedLayoutFirstCollisionDetection } from "../utils/componentDragCollision";

interface IProjectComponentsEditorProps {
  components: IProjectComponent[];
  definitions: IComponentDefinition[];
  theme: Record<string, string>;
  isDisabled: boolean;
  workflow: IProjectWorkflowDefinition;
  toolbar: ReactNode;
  onComponentsChange: (components: IProjectComponent[]) => void;
  onWorkflowChange: (workflow: IProjectWorkflowDefinition) => void;
  onPageWidthChange: (pageWidth: number) => void;
  isWorkflowReady: boolean;
}

function ProjectComponentsEditor({
  components,
  definitions,
  theme,
  isDisabled,
  workflow,
  toolbar,
  onComponentsChange,
  onWorkflowChange,
  onPageWidthChange,
  isWorkflowReady,
}: Readonly<IProjectComponentsEditorProps>) {
  const editor = useProjectComponentEditor({
    components,
    workflow,
    onComponentsChange,
    onWorkflowChange,
  });
  const { theme: productTheme } = useTheme();
  const [activeDragData, setActiveDragData] = useState<ComponentDragData | null>(null);
  const resolvedTheme = useMemo(
    () => ({ ...getStreamlitThemeDefaults(productTheme), ...theme }),
    [productTheme, theme],
  );
  const canvasWorkflow = useMemo(
    () => toWorkflowBuilderDefinition(workflow, components),
    [workflow, components],
  );
  const canvasComponents = useMemo(
    () => toCanvasComponents(components, definitions),
    [components, definitions],
  );
  const tabManagement = useTabManagement({
    findComponent: (componentId) =>
      canvasComponents.find((component) => component.id === componentId),
  });
  const { openTabs, closeTab } = tabManagement;
  useEffect(() => {
    openTabs
      .filter(
        (tab) =>
          tab.type === TabType.Modal &&
          !canvasComponents.some((component) => component.id === tab.modalId),
      )
      .forEach((tab) => closeTab(tab.id));
  }, [canvasComponents, closeTab, openTabs]);
  const activeTab = openTabs.find(
    (tab) => tab.id === tabManagement.activeTabId,
  );
  const isMainFlowActive = activeTab?.type === TabType.MainFlow;
  const isModalActive = activeTab?.type === TabType.Modal;
  const canvasContextType = isModalActive
    ? CanvasContextType.Modal
    : CanvasContextType.Page;
  const activeModalId = isModalActive ? activeTab.modalId : undefined;
  const canvasEditor = useProjectLegacyCanvas({
    components,
    definitions,
    workflow,
    isDisabled,
    contextType: canvasContextType,
    modalId: activeModalId,
    onComponentsChange,
    onWorkflowChange,
    onSelectComponent: editor.selectComponent,
  });
  const projectComponentEditor: IProjectComponentPropertiesEditorProps | undefined =
    editor.selectedComponent
      ? {
          component: editor.selectedComponent,
          components,
          isDisabled,
          activeTabIndex: editor.activeTabIndex,
          onPropertiesChange: (properties) =>
            canvasEditor.updateCanvasComponent(editor.selectedComponent!.key, {
              props: properties,
            }),
          onBindingsChange: (bindings) =>
            canvasEditor.updateCanvasBindings(
              editor.selectedComponent!.key,
              bindings,
            ),
          onActiveTabChange: editor.setActiveTabIndex,
          onAddLayoutChild: editor.addLayoutChild,
          onAddFormChild: editor.addFormChild,
          onAddModalChild: editor.addModalChild,
          onRemoveTab: editor.removeSelectedTab,
        }
      : undefined;
  const projectComponentTreeActions = editor.selectedComponent ? (
    <ProjectComponentTreeActions
      component={editor.selectedComponent}
      isDisabled={isDisabled}
      isRemoveDisabled={!isWorkflowReady}
      canMoveUp={editor.canMoveUp}
      canMoveDown={editor.canMoveDown}
      onMoveUp={() => editor.moveSelectedComponent("up")}
      onMoveDown={() => editor.moveSelectedComponent("down")}
      onRemove={editor.removeSelectedComponent}
    />
  ) : undefined;

  return (
    <section
      aria-labelledby="project-components-heading"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <h2 id="project-components-heading" className="sr-only">Visual builder</h2>

      {isMainFlowActive ? (
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-card">
          <aside className="h-full w-60 flex-shrink-0 overflow-hidden border-r border-[var(--builder-chrome-border)]">
            <BuilderLeftPanel
              builderMode="canvas"
              activeTabType={TabType.MainFlow}
              onAddModal={canvasEditor.addCanvasComponent}
              isDragActive={Boolean(canvasEditor.dragDrop.dropIndicator)}
            />
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {toolbar}
            <TabBar
              tabs={tabManagement.openTabs}
              activeTabId={tabManagement.activeTabId}
              onTabClick={tabManagement.setActiveTabId}
              onTabClose={tabManagement.closeTab}
            />
            <MainFlowView
              formComponents={canvasEditor.canvasComponents}
              workflowDefinition={canvasWorkflow}
              onNodeClick={(nodeId, nodeType) => {
                if (nodeType === "modal") {
                  tabManagement.openTab(TabType.Modal, nodeId);
                  editor.selectComponent(nodeId);
                  return;
                }
                tabManagement.openTab(TabType.MainPage);
              }}
              onSelectComponent={editor.selectComponent}
              onDeleteModal={canvasEditor.removeCanvasComponent}
            />
          </div>
          <aside className="h-full w-80 flex-shrink-0 overflow-hidden border-l border-[var(--builder-chrome-border)]">
            <RightSidebar
              selectedComponent={canvasEditor.canvasComponents.find((component) => component.id === editor.selectedKey) ?? null}
              components={canvasEditor.canvasComponents}
              onUpdateComponent={canvasEditor.updateCanvasComponent}
              onUpdateBindings={canvasEditor.updateCanvasBindings}
              workflowDefinition={canvasWorkflow}
              onWorkflowDefinitionChange={canvasEditor.updateCanvasWorkflow}
              onCloseProperties={() => editor.selectComponent(null)}
              projectComponentEditor={projectComponentEditor}
              projectComponentTreeActions={projectComponentTreeActions}
            />
          </aside>
        </div>
      ) : (
      <DndContext
        sensors={canvasEditor.sensors}
        collisionDetection={nestedLayoutFirstCollisionDetection}
        onDragStart={(event) => {
          setActiveDragData(readComponentDragData(event.active.data.current) ?? null);
          canvasEditor.dragDrop.handleDragStart(event);
        }}
        onDragMove={canvasEditor.dragDrop.handleDragMove}
        onDragCancel={(event) => {
          canvasEditor.dragDrop.handleDragCancel(event);
          setActiveDragData(null);
        }}
        onDragEnd={(event) => {
          canvasEditor.dragDrop.handleDragEnd(event);
          setActiveDragData(null);
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-card">
          <aside className="h-full w-60 flex-shrink-0 overflow-hidden border-r border-[var(--builder-chrome-border)]">
            <BuilderLeftPanel
              builderMode="canvas"
              activeTabType={activeTab?.type ?? TabType.MainPage}
              onAddModal={canvasEditor.addCanvasComponent}
              onAddComponent={canvasEditor.addCanvasComponentFromPalette}
              isDragActive={Boolean(canvasEditor.dragDrop.dropIndicator)}
            />
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {toolbar}
            <TabBar
              tabs={tabManagement.openTabs}
              activeTabId={tabManagement.activeTabId}
              onTabClick={tabManagement.setActiveTabId}
              onTabClose={tabManagement.closeTab}
            />
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <AppCanvasArea
                formComponents={canvasEditor.canvasComponents}
                contextType={canvasContextType}
                modalId={activeModalId}
                theme={resolvedTheme}
                onRemoveComponent={canvasEditor.removeCanvasComponent}
                selectedComponentId={editor.selectedKey}
                onSelectComponent={editor.selectComponent}
                dropIndicator={canvasEditor.dragDrop.dropIndicator}
                layoutDropBlocked={canvasEditor.dragDrop.layoutDropBlocked}
                pageWidth={
                  activeTab?.type === TabType.MainPage
                    ? getPageWidthFromTheme(theme)
                    : undefined
                }
              />
            </div>
          </div>
          <aside className="h-full w-80 flex-shrink-0 overflow-hidden border-l border-[var(--builder-chrome-border)]">
            <RightSidebar
              selectedComponent={canvasEditor.canvasComponents.find((component) => component.id === editor.selectedKey) ?? null}
              components={canvasEditor.canvasComponents}
              onUpdateComponent={canvasEditor.updateCanvasComponent}
              onUpdateBindings={canvasEditor.updateCanvasBindings}
              workflowDefinition={canvasWorkflow}
              onWorkflowDefinitionChange={canvasEditor.updateCanvasWorkflow}
              onCloseProperties={() => editor.selectComponent(null)}
              projectComponentEditor={projectComponentEditor}
              projectComponentTreeActions={projectComponentTreeActions}
              canvasContextType={canvasContextType}
              pageWidth={
                activeTab?.type === TabType.MainPage
                  ? getPageWidthFromTheme(theme)
                  : undefined
              }
              onPageWidthChange={
                activeTab?.type === TabType.MainPage
                  ? onPageWidthChange
                  : undefined
              }
            />
          </aside>
        </div>
        <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
          {activeDragData ? (
            <div className="pointer-events-none inline-flex items-center gap-1 rounded-md border border-border bg-card/95 px-2 py-1 text-xs text-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="max-w-28 truncate">{activeDragData.label}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

    </section>
  );
}

export default ProjectComponentsEditor;
