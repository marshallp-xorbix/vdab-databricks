import type {
  ComponentCategory,
  ComponentType,
} from "./components/componentTypes";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";

export type NewComponentDragData = {
  dragType: "new";
  type: ComponentType | string;
  label: string;
  category: ComponentCategory | string;
};

export type ExistingComponentDragData = {
  dragType: "existing";
  componentId: string;
  type: ComponentType;
  label?: string;
  category: ComponentCategory;
};

export type ComponentDragData =
  | NewComponentDragData
  | ExistingComponentDragData;

export type SortableHandleBindings = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  isDragging: boolean;
};

export type ChildRenderOptions = {
  sortableHandle?: SortableHandleBindings;
  disableInternalDrag?: boolean;
};

export type CanvasDropTargetData = {
  dropType: "canvas";
};

export type LayoutDropTargetData =
  | {
      dropType: "layout";
      parentId: string;
      index: number;
      layoutType: typeof ComponentType.Tabs;
      tabIndex: number;
    }
  | {
      dropType: "layout";
      parentId: string;
      index: number;
      layoutType: Exclude<ComponentType, typeof ComponentType.Tabs>;
    };

export type DropTargetData = CanvasDropTargetData | LayoutDropTargetData;

/** Active layout zone under the pointer where the dragged type is not allowed (Streamlit rules). */
export type LayoutDropBlocked = {
  contextKey: string;
  parentId: string;
  layoutType: ComponentType;
};

export type DropIndicator =
  | {
      dropType: "canvas";
      contextKey: string;
      index: number;
    }
  | {
      dropType: "layout";
      contextKey: string;
      parentId: string;
      index: number;
      layoutType: typeof ComponentType.Tabs;
      tabIndex: number;
    }
  | {
      dropType: "layout";
      contextKey: string;
      parentId: string;
      index: number;
      layoutType: Exclude<ComponentType, typeof ComponentType.Tabs>;
    };
