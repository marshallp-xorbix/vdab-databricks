import BooleanControlPropertiesEditor from "./BooleanControlPropertiesEditor";
import ButtonPropertiesEditor from "./ButtonPropertiesEditor";
import ColumnsPropertiesEditor from "./ColumnsPropertiesEditor";
import DashboardEmbedPropertiesEditor from "./DashboardEmbedPropertiesEditor";
import DateTimeControlPropertiesEditor from "./DateTimeControlPropertiesEditor";
import DropdownPropertiesEditor from "./DropdownPropertiesEditor";
import ExpanderPropertiesEditor from "./ExpanderPropertiesEditor";
import FormPropertiesEditor from "./FormPropertiesEditor";
import GenieChatPropertiesEditor from "./GenieChatPropertiesEditor";
import LabelPropertiesEditor from "./LabelPropertiesEditor";
import ModalPropertiesEditor from "./ModalPropertiesEditor";
import ModelChatPropertiesEditor from "./ModelChatPropertiesEditor";
import ProjectComponentDataPropertiesEditor from "./ProjectComponentDataPropertiesEditor";
import RowsPropertiesEditor from "./RowsPropertiesEditor";
import SliderPropertiesEditor from "./SliderPropertiesEditor";
import TabsPropertiesEditor from "./TabsPropertiesEditor";
import TextInputPropertiesEditor from "./TextInputPropertiesEditor";
import type {
  IProjectComponent,
  ProjectJsonObject,
} from "../models/ProjectComponents";
import type {
  FormChildComponentType,
  LayoutChildComponentType,
  ModalChildComponentType,
} from "../utils/projectComponentFactory";

export interface IProjectComponentPropertiesEditorProps {
  component: IProjectComponent;
  components: IProjectComponent[];
  isDisabled: boolean;
  activeTabIndex: number;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
  onActiveTabChange: (tabIndex: number) => void;
  onAddLayoutChild: (type: LayoutChildComponentType, tabIndex?: number) => void;
  onAddFormChild: (type: FormChildComponentType) => void;
  onAddModalChild: (type: ModalChildComponentType) => void;
  onRemoveTab: (tabIndex: number) => void;
}

const DATA_COMPONENT_TYPES = new Set([
  "FileUpload",
  "DataWindow",
  "EditableDataWindow",
  "AmoebaStory",
  "FlowFieldStory",
  "HeatMapStory",
  "HoneycombStory",
  "NetworkWebStory",
  "PulseWaveStory",
  "SpiralStory",
  "TerrainStory",
  "BarChart",
  "LineChart",
  "PieChart",
  "DonutChart",
]);

function ProjectComponentPropertiesEditor({
  component,
  components,
  isDisabled,
  activeTabIndex,
  onPropertiesChange,
  onBindingsChange,
  onActiveTabChange,
  onAddLayoutChild,
  onAddFormChild,
  onAddModalChild,
  onRemoveTab,
}: Readonly<IProjectComponentPropertiesEditorProps>) {
  if (DATA_COMPONENT_TYPES.has(component.type)) {
    return (
      <ProjectComponentDataPropertiesEditor
        component={component}
        isDisabled={isDisabled}
        onPropertiesChange={onPropertiesChange}
        onBindingsChange={onBindingsChange}
      />
    );
  }

  if (component.type === "TextInput") {
    return (
      <TextInputPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "DashboardEmbed") {
    return (
      <DashboardEmbedPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "GenieChat") {
    return (
      <GenieChatPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "ModelChat") {
    return (
      <ModelChatPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "Button") {
    return (
      <ButtonPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "Checkbox" || component.type === "Toggle") {
    return (
      <BooleanControlPropertiesEditor
        componentKey={component.key}
        componentType={component.type}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "Dropdown") {
    return (
      <DropdownPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "DatePicker" || component.type === "TimePicker") {
    return (
      <DateTimeControlPropertiesEditor
        componentKey={component.key}
        componentType={component.type}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "Slider") {
    return (
      <SliderPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "Label") {
    return (
      <LabelPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        disabled={isDisabled}
        onChange={onPropertiesChange}
      />
    );
  }
  if (component.type === "Expander") {
    return (
      <ExpanderPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        childCount={component.children.length}
        disabled={isDisabled}
        onChange={onPropertiesChange}
        onAddChild={onAddLayoutChild}
      />
    );
  }
  if (component.type === "Columns") {
    return (
      <ColumnsPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        childCount={component.children.length}
        disabled={isDisabled}
        onChange={onPropertiesChange}
        onAddChild={onAddLayoutChild}
      />
    );
  }
  if (component.type === "Rows") {
    return (
      <RowsPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        childCount={component.children.length}
        disabled={isDisabled}
        onChange={onPropertiesChange}
        onAddChild={onAddLayoutChild}
      />
    );
  }
  if (component.type === "Tabs") {
    return (
      <TabsPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        childComponents={component.children.flatMap((key) => {
          const child = components.find((candidate) => candidate.key === key);
          return child ? [child] : [];
        })}
        activeTabIndex={activeTabIndex}
        disabled={isDisabled}
        onChange={onPropertiesChange}
        onActiveTabChange={onActiveTabChange}
        onAddChild={onAddLayoutChild}
        onRemoveTab={onRemoveTab}
      />
    );
  }
  if (component.type === "Form") {
    return (
      <FormPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        childCount={component.children.length}
        disabled={isDisabled}
        onChange={onPropertiesChange}
        onAddChild={onAddFormChild}
      />
    );
  }
  if (component.type === "Modal") {
    return (
      <ModalPropertiesEditor
        componentKey={component.key}
        properties={component.properties}
        childCount={component.children.length}
        disabled={isDisabled}
        onChange={onPropertiesChange}
        onAddChild={onAddModalChild}
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

export default ProjectComponentPropertiesEditor;
