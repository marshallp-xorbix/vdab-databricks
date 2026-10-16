import { useMemo, useCallback, useState } from "react";
import type { FC } from "react";
import { useComponentRegistry } from "../../../context/ComponentRegistryContext";
import type { VdabComponent } from "../../../types/components";
import type { RemoveComponentOptions } from "../../../types/components/componentRemoval";
import type { CanvasContextType } from "../../../types/editor";
import type { DropIndicator, LayoutDropBlocked } from "../../../types/dnd";
import {
  getContextKeyForCanvas,
  getComponentsForContext,
} from "../../../utils/componentOrganization";
import DeleteLayoutDialog from "../DeleteLayoutDialog";
import CanvasView from "./CanvasView";
import {
  ComponentCategory,
  humanizeComponentType,
} from "../../../types/components/componentTypes";

interface AppCanvasAreaProps {
  formComponents: VdabComponent[];
  contextType: CanvasContextType;
  modalId?: string;
  theme: Record<string, string>;
  onRemoveComponent: (
    componentId: string,
    options?: RemoveComponentOptions,
  ) => void;
  selectedComponentId: string | null;
  onSelectComponent?: (id: string | null) => void;
  dropIndicator?: DropIndicator | null;
  layoutDropBlocked?: LayoutDropBlocked | null;
  /** App workspace URL for validating dashboard embed previews on the canvas. */
  workspaceUrl?: string | null;
  /** Max content width in pixels for Main Page WYSIWYG framing. */
  pageWidth?: number;
}

const AppCanvasArea: FC<AppCanvasAreaProps> = ({
  formComponents,
  contextType,
  modalId,
  theme,
  onRemoveComponent,
  selectedComponentId,
  onSelectComponent,
  dropIndicator,
  layoutDropBlocked,
  workspaceUrl = null,
  pageWidth,
}) => {
  const [layoutDeleteOpen, setLayoutDeleteOpen] = useState(false);
  const [layoutToDelete, setLayoutToDelete] = useState<{
    id: string;
    name: string;
    childCount: number;
  } | null>(null);

  const getDescendantIds = useCallback(
    (componentId: string, visited: Set<string> = new Set()): Set<string> => {
      if (visited.has(componentId)) {
        return visited;
      }

      visited.add(componentId);

      const component = formComponents.find((candidate) => candidate.id === componentId);
      if (!component?.children) {
        return visited;
      }

      component.children.forEach((childId) => {
        if (childId && !visited.has(childId)) {
          getDescendantIds(childId, visited);
        }
      });

      return visited;
    },
    [formComponents],
  );

  const handleRemoveComponent = useCallback(
    (componentId: string, options?: RemoveComponentOptions) => {
      const component = formComponents.find((candidate) => candidate.id === componentId);

      if (
        component?.category === ComponentCategory.Layout &&
        options?.mode === undefined
      ) {
        const descendantIds = Array.from(getDescendantIds(componentId)).filter(
          (id) => id !== componentId,
        );

        if (descendantIds.length > 0) {
          setLayoutToDelete({
            id: componentId,
            name: humanizeComponentType(component.type),
            childCount: descendantIds.length,
          });
          setLayoutDeleteOpen(true);
          return;
        }
      }

      onRemoveComponent(componentId, options);
    },
    [formComponents, getDescendantIds, onRemoveComponent],
  );

  const handleCancelLayoutDelete = useCallback(() => {
    setLayoutDeleteOpen(false);
    setLayoutToDelete(null);
  }, []);

  const handleDeleteLayoutAndChildren = useCallback(() => {
    if (!layoutToDelete) {
      return;
    }

    onRemoveComponent(layoutToDelete.id, { mode: "deleteSubtree" });
    setLayoutDeleteOpen(false);
    setLayoutToDelete(null);
  }, [layoutToDelete, onRemoveComponent]);

  const { loading: registryLoading, error: registryError } =
    useComponentRegistry();

  const contextComponents = useMemo(
    () => getComponentsForContext(formComponents, contextType, modalId),
    [formComponents, contextType, modalId],
  );

  if (registryLoading) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-card p-4">
        <div className="text-center text-muted-foreground">
          Loading component registry...
        </div>
      </div>
    );
  }

  if (registryError) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-card p-4">
        <div className="text-center text-destructive">
          Error loading component registry: {registryError}
          <br />
          <span className="text-sm text-muted-foreground">Using fallback defaults</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-card">
      <div className="flex min-h-0 flex-1 flex-col">
        <CanvasView
          contextComponents={contextComponents}
          formComponents={formComponents}
          theme={theme}
          selectedComponentId={selectedComponentId}
          onSelectComponent={onSelectComponent}
          onRemoveComponent={handleRemoveComponent}
          dropIndicator={dropIndicator}
          layoutDropBlocked={layoutDropBlocked}
          contextKey={getContextKeyForCanvas(contextType, modalId)}
          workspaceUrl={workspaceUrl}
          pageWidth={pageWidth}
        />
      </div>

      {layoutToDelete && (
        <DeleteLayoutDialog
          isOpen={layoutDeleteOpen}
          layoutName={layoutToDelete.name}
          componentCount={layoutToDelete.childCount}
          onConfirmDelete={handleDeleteLayoutAndChildren}
          onCancel={handleCancelLayoutDelete}
        />
      )}
    </div>
  );
};

export default AppCanvasArea;
