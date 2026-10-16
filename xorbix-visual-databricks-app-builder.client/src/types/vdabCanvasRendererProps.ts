import type { ReactNode } from "react";
import type { VdabComponent } from "./components/vdabComponent";
import type { ChildRenderOptions, DropIndicator, LayoutDropBlocked } from "./dnd";

/**
 * Superset of props the canvas may pass to a registered component renderer.
 * Leaf renderers use only `component` and `theme`; layout renderers use the rest.
 */
export interface VdabCanvasRendererProps {
  component: VdabComponent;
  theme: Record<string, string>;
  /** Present on the builder canvas for dashboard embed validation; optional elsewhere. */
  workspaceUrl?: string | null;
  /**
   * When true (App Builder canvas only), embedded iframes use `pointer-events: none` so
   * clicks reach the canvas wrapper and the component stays selectable.
   */
  isBuilderCanvas?: boolean;
  allComponents?: VdabComponent[];
  selectedComponentId?: string;
  onSelect?: (id: string) => void;
  renderChild?: (
    component: VdabComponent,
    options?: ChildRenderOptions,
  ) => ReactNode;
  dropIndicator?: DropIndicator | null;
  layoutDropBlocked?: LayoutDropBlocked | null;
}
