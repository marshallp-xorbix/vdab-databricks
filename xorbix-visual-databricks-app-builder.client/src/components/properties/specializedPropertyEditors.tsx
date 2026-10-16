import type { ReactElement } from "react";
import type { VdabComponent } from "../../types/components";
import { ComponentType } from "../../types/components/componentTypes";
import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import { BarChartPropertyEditor } from "./BarChartPropertyEditor";
import { LineChartPropertyEditor } from "./LineChartPropertyEditor";
import { PieChartPropertyEditor } from "./PieChartPropertyEditor";
import { DonutChartPropertyEditor } from "./DonutChartPropertyEditor";
import { TabsPropertyEditor } from "./TabsPropertyEditor";
import { DashboardEmbedPropertyEditor } from "./DashboardEmbedPropertyEditor";
import { GenieChatPropertyEditor } from "./GenieChatPropertyEditor";
import { ModelChatPropertyEditor } from "./ModelChatPropertyEditor";
import { AmoebaStoryPropertyEditor } from "./AmoebaStoryPropertyEditor";
import { NetworkWebStoryPropertyEditor } from "./NetworkWebStoryPropertyEditor";
import { TerrainStoryPropertyEditor } from "./TerrainStoryPropertyEditor";
import { HeatMapStoryPropertyEditor } from "./HeatMapStoryPropertyEditor";
import { PulseWaveStoryPropertyEditor } from "./PulseWaveStoryPropertyEditor";
import { FlowFieldStoryPropertyEditor } from "./FlowFieldStoryPropertyEditor";
import { HoneycombStoryPropertyEditor } from "./HoneycombStoryPropertyEditor";
import { SpiralStoryPropertyEditor } from "./SpiralStoryPropertyEditor";

interface ISpecializedPropertyEditorContext {
  component: VdabComponent;
  components: VdabComponent[];
  onPropertyChange: (key: string, value: unknown) => void;
  onDeleteTab?: (componentId: string, tabIndex: number) => void;
  workspaceUrl: string | null;
  normalizedAppResources: NormalizedAppResource[];
}

type SpecializedEditorFactory = (
  context: ISpecializedPropertyEditorContext,
) => ReactElement;

const SPECIALIZED_PROPERTY_EDITORS: Partial<
  Record<string, SpecializedEditorFactory>
> = {
  [ComponentType.DashboardEmbed]: ({ component, onPropertyChange, workspaceUrl }) => (
    <DashboardEmbedPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
      workspaceUrl={workspaceUrl}
    />
  ),
  [ComponentType.GenieChat]: ({
    component,
    normalizedAppResources,
    onPropertyChange,
  }) => (
    <GenieChatPropertyEditor
      component={component}
      normalizedResources={normalizedAppResources}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.ModelChat]: ({
    component,
    normalizedAppResources,
    onPropertyChange,
  }) => (
    <ModelChatPropertyEditor
      component={component}
      normalizedResources={normalizedAppResources}
      onPropertyChange={onPropertyChange}
    />
  ),
  BarChart: ({ component, onPropertyChange }) => (
    <BarChartPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  LineChart: ({ component, onPropertyChange }) => (
    <LineChartPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  PieChart: ({ component, onPropertyChange }) => (
    <PieChartPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  DonutChart: ({ component, onPropertyChange }) => (
    <DonutChartPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.AmoebaStory]: ({ component, onPropertyChange }) => (
    <AmoebaStoryPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.NetworkWebStory]: ({ component, onPropertyChange }) => (
    <NetworkWebStoryPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.TerrainStory]: ({ component, onPropertyChange }) => (
    <TerrainStoryPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.HeatMapStory]: ({ component, onPropertyChange }) => (
    <HeatMapStoryPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.PulseWaveStory]: ({ component, onPropertyChange }) => (
    <PulseWaveStoryPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.FlowFieldStory]: ({ component, onPropertyChange }) => (
    <FlowFieldStoryPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.HoneycombStory]: ({ component, onPropertyChange }) => (
    <HoneycombStoryPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.SpiralStory]: ({ component, onPropertyChange }) => (
    <SpiralStoryPropertyEditor
      component={component}
      onPropertyChange={onPropertyChange}
    />
  ),
  [ComponentType.Tabs]: ({
    component,
    components,
    onPropertyChange,
    onDeleteTab,
  }) => (
    <TabsPropertyEditor
      component={component}
      allComponents={components}
      onPropertyChange={onPropertyChange}
      onDeleteTab={onDeleteTab}
    />
  ),
};

/**
 * Returns a specialized property editor for component types that own a dedicated
 * editor, or `null` when the generic property-list path should be used.
 */
export function tryRenderSpecializedPropertyEditor(
  context: ISpecializedPropertyEditorContext,
): ReactElement | null {
  const factory = SPECIALIZED_PROPERTY_EDITORS[context.component.type];
  return factory ? factory(context) : null;
}

/** Re-export for callers that need the props shape on the factory. */
export type { ISpecializedPropertyEditorContext };
