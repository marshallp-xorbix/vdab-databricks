import type { FC } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripHorizontal } from "lucide-react";
import { componentRendererFactory } from "../../renderers";
import type { VdabComponent } from "../../../types/components";
import {
  ComponentCategory as Category,
  humanizeComponentType,
} from "../../../types/components/componentTypes";
import type {
  ChildRenderOptions,
  ComponentDragData,
  DropIndicator,
  LayoutDropBlocked,
  SortableHandleBindings,
} from "../../../types/dnd";

export interface AppComponentProps {
  component: VdabComponent;
  theme: Record<string, string>;
  onRemove: () => void;
  onSelect: (id: string) => void;
  isSelected: boolean;
  selectedComponentId?: string;
  allComponents: VdabComponent[];
  onRemoveChildFromLayout?: (parentId: string, childId: string) => void;
  dropIndicator?: DropIndicator | null;
  layoutDropBlocked?: LayoutDropBlocked | null;
  sortableHandle?: SortableHandleBindings;
  disableInternalDrag?: boolean;
  workspaceUrl?: string | null;
}

export const AppComponent: FC<AppComponentProps> = ({
  component,
  theme,
  onRemove,
  onSelect,
  isSelected,
  selectedComponentId,
  allComponents,
  onRemoveChildFromLayout,
  dropIndicator,
  layoutDropBlocked,
  sortableHandle,
  disableInternalDrag = false,
  workspaceUrl = null,
}) => {
  const dragData: ComponentDragData = {
    dragType: "existing",
    componentId: component.id,
    type: component.type,
    label: humanizeComponentType(component.type),
    category: component.category,
  };

  const {
    attributes: internalAttributes,
    listeners: internalListeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `canvas-component-${component.id}`,
    data: dragData,
    disabled: disableInternalDrag,
  });

  const handleAttributes = sortableHandle?.attributes ?? internalAttributes;
  const handleListeners = sortableHandle?.listeners ?? internalListeners;
  const isHandleDragging = sortableHandle?.isDragging ?? isDragging;
  const renderComponent = () => {
    const RendererComponent = componentRendererFactory.getRenderer(
      component.type,
    );

    if (!RendererComponent) {
      return (
        <div className="text-muted-foreground">
          Unknown component type: {component.type}
        </div>
      );
    }

    const isLayout = component.category === Category.Layout;

    if (isLayout) {
      return (
        <RendererComponent
          component={component}
          theme={theme}
          allComponents={allComponents}
          selectedComponentId={selectedComponentId}
          onSelect={onSelect}
          dropIndicator={dropIndicator}
          layoutDropBlocked={layoutDropBlocked}
          workspaceUrl={workspaceUrl}
          renderChild={(
            childComp: VdabComponent,
            childRenderOptions?: ChildRenderOptions,
          ) => {
            const handleRemoveChild = () =>
              onRemoveChildFromLayout?.(component.id, childComp.id);
            return (
              <AppComponent
                key={childComp.id}
                component={childComp}
                theme={theme}
                onRemove={handleRemoveChild}
                onSelect={onSelect}
                isSelected={selectedComponentId === childComp.id}
                selectedComponentId={selectedComponentId ?? undefined}
                allComponents={allComponents}
                onRemoveChildFromLayout={onRemoveChildFromLayout}
                dropIndicator={dropIndicator}
                layoutDropBlocked={layoutDropBlocked}
                sortableHandle={childRenderOptions?.sortableHandle}
                disableInternalDrag={childRenderOptions?.disableInternalDrag}
                workspaceUrl={workspaceUrl}
              />
            );
          }}
        />
      );
    }
    return (
      <RendererComponent
        component={component}
        theme={theme}
        workspaceUrl={workspaceUrl}
        isBuilderCanvas
      />
    );
  };

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-all hover:[&>_.appcomponent-controls]:opacity-100 hover:[&>_.appcomponent-controls]:pointer-events-auto ${
        isHandleDragging ? "opacity-45" : ""
      } ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      {/* Drag handle (notch) - anchored to the component bounding box */}
      <button
        type="button"
        aria-label="Drag component"
        className={`appcomponent-controls absolute left-1/2 top-0 z-30 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-border bg-card/90 shadow-sm transition-opacity ${
          isSelected || isHandleDragging
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        onMouseDown={(e) => {
          // Ensure selection happens before drag begins.
          e.stopPropagation();
          onSelect(component.id);
        }}
        {...handleListeners}
        {...handleAttributes}
        ref={sortableHandle?.setActivatorNodeRef}
      >
        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
      </button>

      <div
        className="cursor-pointer relative"
        onClick={() => onSelect(component.id)}
      >
        {renderComponent()}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={`appcomponent-controls absolute -right-2 -top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white text-xs hover:bg-destructive/90 transition-opacity ${
          isSelected ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-label="Remove component"
        type="button"
      >
        ×
      </button>
    </div>
  );
};
