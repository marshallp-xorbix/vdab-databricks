import { Button } from "./ui/button";
import type { IProjectComponent } from "../models/ProjectComponents";

interface IProjectComponentButtonProps {
  component: IProjectComponent;
  position: string;
  selectedKey: string | null;
  disabled: boolean;
  onSelect: (componentKey: string) => void;
}

function ProjectComponentButton({
  component,
  position,
  selectedKey,
  disabled,
  onSelect,
}: Readonly<IProjectComponentButtonProps>) {
  return (
    <Button
      type="button"
      variant={component.key === selectedKey ? "secondary" : "ghost"}
      className="w-full justify-start"
      aria-pressed={component.key === selectedKey}
      disabled={disabled}
      onClick={() => onSelect(component.key)}
    >
      {position}. {component.type}: {readLabel(component)}
    </Button>
  );
}

function readLabel(component: IProjectComponent): string {
  const label = component.type === "Label"
    ? component.properties.text
    : component.type === "Expander"
    ? component.properties.sectionTitle
    : component.type === "Columns"
    ? `${readSlotCount(component.properties.columnCount)} columns`
    : component.type === "Rows"
    ? `${readSlotCount(component.properties.rowCount)} rows`
    : component.type === "Tabs"
    ? `${readTabCount(component.properties.tabs)} tabs`
    : component.type === "Form"
    ? `${component.children.length} form controls`
    : component.type === "Modal"
    ? component.properties.title
    : component.properties.label;
  return typeof label === "string" && label.trim() !== ""
    ? label
    : component.codeName ?? component.key;
}

function readTabCount(value: unknown): number {
  return Array.isArray(value) && value.every((tab) => typeof tab === "string")
    ? value.length
    : 2;
}

function readSlotCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 2;
}

export default ProjectComponentButton;
