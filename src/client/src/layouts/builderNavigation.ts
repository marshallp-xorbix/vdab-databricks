import { Code2, LayoutGrid, Settings2, Workflow } from "lucide-react";

export const BUILDER_SECTIONS = [
  { key: "components", label: "Canvas", icon: LayoutGrid },
  { key: "workflows", label: "Workflow", icon: Workflow },
  { key: "code", label: "Code", icon: Code2 },
  { key: "settings", label: "Settings", icon: Settings2 },
] as const;
