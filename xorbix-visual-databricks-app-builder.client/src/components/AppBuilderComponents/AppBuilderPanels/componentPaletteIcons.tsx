import type { ElementType } from "react";
import {
  BarChartBig,
  Bot,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronsUpDown,
  CircleDot,
  Clock,
  Columns3,
  Database,
  LineChart,
  MessageSquare,
  Mountain,
  MousePointerClick,
  PieChart,
  RectangleVertical,
  Rows3,
  Share2,
  SlidersHorizontal,
  Map,
  Activity,
  GitBranch,
  Hexagon,
  Orbit,
  Table,
  Text,
  ToggleLeft,
  Type,
  Upload,
} from "lucide-react";
import type { VdabComponent } from "../../../types/components";
import TouchpadFlippedIcon from "./TouchpadFlippedIcon";

const iconMap: Record<string, ElementType> = {
  Type,
  MousePointerClick,
  CheckSquare,
  ToggleLeft,
  ChevronsUpDown,
  ChevronDown,
  Calendar,
  Clock,
  SlidersHorizontal,
  Columns3,
  Rows3,
  Table,
  RectangleVertical,
  MessageSquare,
  Upload,
  Text,
  BarChart: BarChartBig,
  LineChart,
  PieChart,
  DonutChart: PieChart,
  AmoebaStory: CircleDot,
  NetworkWebStory: Share2,
  TerrainStory: Mountain,
  HeatMapStory: Map,
  PulseWaveStory: Activity,
  FlowFieldStory: GitBranch,
  HoneycombStory: Hexagon,
  SpiralStory: Orbit,
  LayoutPanelTop: TouchpadFlippedIcon,
  Bot,
  default: Database,
};

export const getPaletteIconByName = (iconName?: string): ElementType => {
  if (!iconName) {
    return iconMap.default;
  }

  return iconMap[iconName] || iconMap.default;
};

export const getPaletteIconForComponentType = (
  components: VdabComponent[] | undefined,
  componentType: string,
): ElementType => {
  const componentDefinition = components?.find(
    (component) => component.type === componentType,
  );

  return getPaletteIconByName(componentDefinition?.icon);
};
