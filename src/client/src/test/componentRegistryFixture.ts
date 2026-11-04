import type { IComponentRegistry } from "../models/ComponentRegistry";
import {
  PROJECT_COMPONENT_ADD_TYPES,
  createProjectComponent,
} from "../utils/projectComponentFactory";

const layoutComponentTypes = new Set(["Columns", "Rows", "Form", "Tabs", "Expander"]);
const dataComponentTypes = new Set([
  "DataWindow", "EditableDataWindow", "DashboardEmbed", "GenieChat", "ModelChat",
]);
const pageComponentTypes = new Set(["Modal"]);
const visualizationComponentTypes = new Set([
  "BarChart", "LineChart", "PieChart", "DonutChart", "AmoebaStory",
  "NetworkWebStory", "TerrainStory", "HeatMapStory", "PulseWaveStory",
  "FlowFieldStory", "HoneycombStory", "SpiralStory",
]);

/** Component definitions returned by the standalone API in Databricks-mode tests. */
export const componentRegistryFixture: IComponentRegistry = {
  version: 1,
  bindingSchemas: [],
  components: PROJECT_COMPONENT_ADD_TYPES.map((type) => {
    const category = layoutComponentTypes.has(type)
      ? "Layout"
      : dataComponentTypes.has(type)
        ? "Data"
        : pageComponentTypes.has(type)
          ? "Page"
          : visualizationComponentTypes.has(type)
            ? "Visualization"
            : "Controls";
    const defaults = createProjectComponent(type, []);

    return {
      id: `template-${type.toLowerCase()}`,
      codeName: `template${type}`,
      type,
      category,
      icon: "Square",
      layout: null,
      schemaVersion: 1,
      bindings: null,
      supportedBindings: null,
      supportedEvents: type === "Button" ? ["onClick"] : null,
      children: null,
      props: defaults.properties,
    };
  }),
};
