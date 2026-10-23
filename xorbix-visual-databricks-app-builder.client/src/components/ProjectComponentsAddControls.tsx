import { Button } from "./ui/button";
import {
  PROJECT_COMPONENT_ADD_TYPES,
  type ProjectComponentAddType,
} from "../utils/projectComponentFactory";

interface IProjectComponentsAddControlsProps {
  isDisabled: boolean;
  onAdd: (type: ProjectComponentAddType) => void;
}

const ADD_COMPONENT_LABELS: Record<ProjectComponentAddType, string> = {
  DashboardEmbed: "Add dashboard embed",
  GenieChat: "Add Genie chat",
  ModelChat: "Add Model chat",
  TextInput: "Add Text input",
  Button: "Add button",
  Checkbox: "Add checkbox",
  Toggle: "Add toggle",
  Dropdown: "Add dropdown",
  DatePicker: "Add date picker",
  TimePicker: "Add time picker",
  FileUpload: "Add file upload",
  DataWindow: "Add data window",
  EditableDataWindow: "Add editable data window",
  Slider: "Add slider",
  Label: "Add label",
  Expander: "Add expander",
  Columns: "Add columns",
  Rows: "Add rows",
  Tabs: "Add tabs",
  Form: "Add form",
  Modal: "Add modal",
  BarChart: "Add bar chart",
  LineChart: "Add line chart",
  PieChart: "Add pie chart",
  DonutChart: "Add donut chart",
  AmoebaStory: "Add Amoeba story",
  FlowFieldStory: "Add Flow Field story",
  HeatMapStory: "Add heat map story",
  HoneycombStory: "Add honeycomb story",
  NetworkWebStory: "Add network web story",
  PulseWaveStory: "Add pulse wave story",
  SpiralStory: "Add spiral story",
  TerrainStory: "Add terrain story",
};

function ProjectComponentsAddControls({
  isDisabled,
  onAdd,
}: Readonly<IProjectComponentsAddControlsProps>) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_COMPONENT_ADD_TYPES.map((type) => (
        <Button
          key={type}
          type="button"
          variant="outline"
          disabled={isDisabled}
          onClick={() => onAdd(type)}
        >
          {ADD_COMPONENT_LABELS[type]}
        </Button>
      ))}
    </div>
  );
}

export default ProjectComponentsAddControls;
