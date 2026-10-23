import { useEffect, useState } from "react";
import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";

interface INetworkWebStoryVisualPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
}

const SELECT_SETTINGS = [
  {
    name: "layoutAlgorithm",
    label: "Layout algorithm",
    fallback: "force",
    options: [
      ["force", "Force"],
      ["radial", "Radial"],
    ],
  },
  {
    name: "nodeSizeBy",
    label: "Node size by",
    fallback: "degree",
    options: [
      ["degree", "Degree"],
      ["value", "Value"],
      ["none", "None"],
    ],
  },
  {
    name: "nodeColorBy",
    label: "Node color by",
    fallback: "category",
    options: [
      ["category", "Category"],
      ["health_score", "Health score"],
      ["risk_score", "Risk score"],
    ],
  },
  {
    name: "edgeWidthBy",
    label: "Edge width by",
    fallback: "weight",
    options: [
      ["weight", "Weight"],
      ["value", "Edge value"],
      ["frequency", "Frequency"],
      ["none", "None"],
    ],
  },
  {
    name: "edgeColorBy",
    label: "Edge color by",
    fallback: "relationship_type",
    options: [
      ["relationship_type", "Relationship type"],
      ["risk_score", "Risk score"],
      ["status", "Status"],
      ["none", "None"],
    ],
  },
] as const;
const NUMERIC_SETTINGS = [
  {
    name: "highlightDepth",
    label: "Highlight depth",
    fallback: 1,
    minimum: 1,
    maximum: 3,
    step: 1,
  },
  {
    name: "minWeightFilter",
    label: "Minimum edge weight",
    fallback: 0,
    minimum: 0,
    maximum: undefined,
    step: "any",
  },
  {
    name: "maxNodes",
    label: "Maximum nodes",
    fallback: 300,
    minimum: 10,
    maximum: 500,
    step: 10,
  },
  {
    name: "maxEdges",
    label: "Maximum edges",
    fallback: 800,
    minimum: 10,
    maximum: 2_000,
    step: 10,
  },
] as const;

function NetworkWebStoryVisualPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onPropertiesChange,
}: Readonly<INetworkWebStoryVisualPropertiesEditorProps>) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [editingSettingName, setEditingSettingName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setDraftValues((current) =>
      Object.fromEntries(
        NUMERIC_SETTINGS.map((setting) => {
          if (setting.name === editingSettingName) {
            return [setting.name, current[setting.name] ?? ""];
          }

          const value = properties[setting.name];
          return [
            setting.name,
            typeof value === "number"
              ? String(value)
              : String(setting.fallback),
          ];
        }),
      ),
    );
  }, [editingSettingName, properties]);

  function change(name: string, value: string | number | boolean) {
    onPropertiesChange({ ...properties, [name]: value });
  }

  return (
    <fieldset
      className="grid gap-3 rounded-lg border border-border p-4"
      disabled={disabled}
    >
      <legend className="px-1 text-sm font-medium">
        Network web appearance
      </legend>
      <p className="text-sm text-muted-foreground">
        Select the layout and graph encodings, then set the visible graph
        limits.
      </p>
      {SELECT_SETTINGS.map((setting) => {
        const id = `network-web-${setting.name}-${componentKey}`;
        const value =
          typeof properties[setting.name] === "string"
            ? (properties[setting.name] as string)
            : setting.fallback;
        return (
          <div key={setting.name} className="grid gap-2">
            <Label htmlFor={id}>{setting.label}</Label>
            <select
              id={id}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={value}
              onChange={(event) => change(setting.name, event.target.value)}
            >
              {setting.options.map(([option, label]) => (
                <option key={option} value={option}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      {NUMERIC_SETTINGS.map((setting) => {
        const id = `network-web-${setting.name}-${componentKey}`;
        const value =
          typeof properties[setting.name] === "number"
            ? (properties[setting.name] as number)
            : setting.fallback;
        return (
          <div key={setting.name} className="grid gap-2">
            <Label htmlFor={id}>{setting.label}</Label>
            <input
              id={id}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              type="number"
              min={setting.minimum}
              max={setting.maximum}
              step={setting.step}
              value={draftValues[setting.name] ?? String(value)}
              onFocus={() => setEditingSettingName(setting.name)}
              onBlur={() => setEditingSettingName(null)}
              onChange={(event) => {
                const nextText = event.target.value;
                setDraftValues((previous) => ({
                  ...previous,
                  [setting.name]: nextText,
                }));
                const nextValue = Number(nextText);
                if (nextText !== "" && Number.isFinite(nextValue))
                  change(setting.name, nextValue);
              }}
            />
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <input
          id={`network-web-show-arrows-${componentKey}`}
          type="checkbox"
          checked={
            typeof properties.showArrows === "boolean"
              ? properties.showArrows
              : true
          }
          onChange={(event) => change("showArrows", event.target.checked)}
        />
        <Label htmlFor={`network-web-show-arrows-${componentKey}`}>
          Show relationship arrows
        </Label>
      </div>
    </fieldset>
  );
}

export default NetworkWebStoryVisualPropertiesEditor;
