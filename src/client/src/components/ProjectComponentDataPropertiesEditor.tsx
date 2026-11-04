import AmoebaStoryPropertiesEditor from "./AmoebaStoryPropertiesEditor";
import CartesianChartPropertiesEditor from "./CartesianChartPropertiesEditor";
import DataWindowPropertiesEditor from "./DataWindowPropertiesEditor";
import EditableDataWindowPropertiesEditor from "./EditableDataWindowPropertiesEditor";
import FileUploadPropertiesEditor from "./FileUploadPropertiesEditor";
import FlowFieldStoryPropertiesEditor from "./FlowFieldStoryPropertiesEditor";
import HeatMapStoryPropertiesEditor from "./HeatMapStoryPropertiesEditor";
import HoneycombStoryPropertiesEditor from "./HoneycombStoryPropertiesEditor";
import NetworkWebStoryPropertiesEditor from "./NetworkWebStoryPropertiesEditor";
import PulseWaveStoryPropertiesEditor from "./PulseWaveStoryPropertiesEditor";
import SpiralStoryPropertiesEditor from "./SpiralStoryPropertiesEditor";
import TerrainStoryPropertiesEditor from "./TerrainStoryPropertiesEditor";
import type {
  IProjectComponent,
  ProjectJsonObject,
} from "../models/ProjectComponents";

interface IProjectComponentDataPropertiesEditorProps {
  component: IProjectComponent;
  isDisabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function ProjectComponentDataPropertiesEditor({
  component,
  isDisabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IProjectComponentDataPropertiesEditorProps>) {
  if (component.type === "FileUpload") {
    return (
      <FileUploadPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        bindings={component.bindings}
        disabled={isDisabled}
        onPropertiesChange={onPropertiesChange}
        onBindingsChange={onBindingsChange}
      />
    );
  }

  if (component.type === "DataWindow") {
    return (
      <DataWindowPropertiesEditor
        componentKey={component.key}
        editable={false}
        properties={component.properties}
        bindings={component.bindings}
        disabled={isDisabled}
        onPropertiesChange={onPropertiesChange}
        onBindingsChange={onBindingsChange}
      />
    );
  }

  if (component.type === "EditableDataWindow") {
    return (
      <EditableDataWindowPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        bindings={component.bindings}
        disabled={isDisabled}
        onPropertiesChange={onPropertiesChange}
        onBindingsChange={onBindingsChange}
      />
    );
  }

  const storyEditorProps = {
    componentKey: component.key,
    properties: component.properties,
    bindings: component.bindings,
    disabled: isDisabled,
    onPropertiesChange,
    onBindingsChange,
  };

  if (component.type === "AmoebaStory") {
    return <AmoebaStoryPropertiesEditor {...storyEditorProps} />;
  }
  if (component.type === "FlowFieldStory") {
    return <FlowFieldStoryPropertiesEditor {...storyEditorProps} />;
  }
  if (component.type === "HeatMapStory") {
    return <HeatMapStoryPropertiesEditor {...storyEditorProps} />;
  }
  if (component.type === "HoneycombStory") {
    return <HoneycombStoryPropertiesEditor {...storyEditorProps} />;
  }
  if (component.type === "NetworkWebStory") {
    return <NetworkWebStoryPropertiesEditor {...storyEditorProps} />;
  }
  if (component.type === "PulseWaveStory") {
    return <PulseWaveStoryPropertiesEditor {...storyEditorProps} />;
  }
  if (component.type === "SpiralStory") {
    return <SpiralStoryPropertiesEditor {...storyEditorProps} />;
  }
  if (component.type === "TerrainStory") {
    return <TerrainStoryPropertiesEditor {...storyEditorProps} />;
  }
  if (
    component.type === "BarChart" ||
    component.type === "LineChart" ||
    component.type === "PieChart" ||
    component.type === "DonutChart"
  ) {
    return (
      <CartesianChartPropertiesEditor
        chartType={component.type}
        componentKey={component.key}
        properties={component.properties}
        bindings={component.bindings}
        disabled={isDisabled}
        onPropertiesChange={onPropertiesChange}
        onBindingsChange={onBindingsChange}
      />
    );
  }

  return (
    <p role="status" className="rounded-md border border-border p-4 text-sm">
      The {component.type || "selected"} editor is not available in this slice.
      Its saved configuration is preserved.
    </p>
  );
}

export default ProjectComponentDataPropertiesEditor;
