import type { FC } from "react";
import { ComponentType } from "../../types/components";
import { toCanonicalComponentType } from "../../utils/componentEnumGuards";
import type { VdabCanvasRendererProps } from "../../types/vdabCanvasRendererProps";
import {
  TextInputRenderer,
  ButtonRenderer,
  CheckboxRenderer,
  ToggleRenderer,
  DropdownRenderer,
  DatePickerRenderer,
  TimePickerRenderer,
  SliderRenderer,
  LabelRenderer,
} from "./standard";
import {
  ColumnsRenderer,
  RowsRenderer,
  FormRenderer,
  ExpanderRenderer,
  TabsRenderer,
} from "./layout";
import {
  DataWindowRenderer,
  EditableDataWindowRenderer,
  FileUploadRenderer,
} from "./data";
import {
  BarChartRenderer,
  LineChartRenderer,
  PieChartRenderer,
  DonutChartRenderer,
} from "./charts";
import {
  AmoebaStoryRenderer,
  NetworkWebStoryRenderer,
  TerrainStoryRenderer,
  HeatMapStoryRenderer,
  PulseWaveStoryRenderer,
  FlowFieldStoryRenderer,
  HoneycombStoryRenderer,
  SpiralStoryRenderer,
} from "./stories";
import { DashboardEmbedRenderer } from "./embed";
import { GenieChatRenderer } from "./genie";
import { ModelChatRenderer } from "./model";
/**
 * Factory for mapping ComponentType to their respective renderer components
 * This eliminates the need for switch statements throughout the codebase
 *
 * Note: Modal is intentionally not registered here as it has no visual representation
 * on the canvas. Modals are managed through the Main Flow diagram and their own tabs.
 */
class ComponentRendererFactory {
  private renderers: Map<string, FC<VdabCanvasRendererProps>>;

  constructor() {
    this.renderers = new Map<string, FC<VdabCanvasRendererProps>>([
      // Modal intentionally excluded - no canvas rendering
      [ComponentType.TextInput, TextInputRenderer],
      [ComponentType.Button, ButtonRenderer],
      [ComponentType.Checkbox, CheckboxRenderer],
      [ComponentType.Toggle, ToggleRenderer],
      [ComponentType.Dropdown, DropdownRenderer],
      [ComponentType.DatePicker, DatePickerRenderer],
      [ComponentType.TimePicker, TimePickerRenderer],
      [ComponentType.Slider, SliderRenderer],
      [ComponentType.Columns, ColumnsRenderer],
      [ComponentType.Rows, RowsRenderer],
      [ComponentType.DataWindow, DataWindowRenderer],
      [ComponentType.EditableDataWindow, EditableDataWindowRenderer],
      [ComponentType.Form, FormRenderer],
      [ComponentType.Expander, ExpanderRenderer],
      [ComponentType.FileUpload, FileUploadRenderer],
      [ComponentType.Label, LabelRenderer],
      [ComponentType.BarChart, BarChartRenderer],
      [ComponentType.LineChart, LineChartRenderer],
      [ComponentType.PieChart, PieChartRenderer],
      [ComponentType.DonutChart, DonutChartRenderer],
      [ComponentType.AmoebaStory, AmoebaStoryRenderer],
      [ComponentType.NetworkWebStory, NetworkWebStoryRenderer],
      [ComponentType.TerrainStory, TerrainStoryRenderer],
      [ComponentType.HeatMapStory, HeatMapStoryRenderer],
      [ComponentType.PulseWaveStory, PulseWaveStoryRenderer],
      [ComponentType.FlowFieldStory, FlowFieldStoryRenderer],
      [ComponentType.HoneycombStory, HoneycombStoryRenderer],
      [ComponentType.SpiralStory, SpiralStoryRenderer],
      [ComponentType.Tabs, TabsRenderer],
      [ComponentType.DashboardEmbed, DashboardEmbedRenderer],
      [ComponentType.GenieChat, GenieChatRenderer],
      [ComponentType.ModelChat, ModelChatRenderer],
    ]);
  }

  /**
   * Get the renderer component for a given component type
   * @param componentType - The ComponentType enum value
   * @returns The renderer component or null if not found
   */
  getRenderer(componentType: string): FC<VdabCanvasRendererProps> | null {
    const canonical = toCanonicalComponentType(componentType);
    if (canonical == null) {
      return null;
    }
    return this.renderers.get(canonical) || null;
  }

  /**
   * Check if a renderer exists for the given component type
   * @param componentType - The ComponentType enum value
   * @returns True if renderer exists
   */
  hasRenderer(componentType: string): boolean {
    const canonical = toCanonicalComponentType(componentType);
    return canonical != null && this.renderers.has(canonical);
  }

  /**
   * Register a new renderer for a component type (for extensibility)
   * @param componentType - The ComponentType enum value
   * @param rendererComponent - The renderer component
   */
  registerRenderer(
    componentType: string,
    rendererComponent: FC<VdabCanvasRendererProps>,
  ): void {
    this.renderers.set(componentType, rendererComponent);
  }

  /**
   * Get all registered component types
   * @returns Array of registered component types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys());
  }
}

// Export singleton instance
export const componentRendererFactory = new ComponentRendererFactory();

// Also export the class for testing purposes
export default ComponentRendererFactory;
