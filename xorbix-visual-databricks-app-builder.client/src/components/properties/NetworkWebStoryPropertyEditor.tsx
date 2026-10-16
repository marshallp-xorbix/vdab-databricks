import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import { StringPropertyEditor } from "./StringPropertyEditor";
import { SelectPropertyEditor } from "./SelectPropertyEditor";
import { NumberPropertyEditor } from "./NumberPropertyEditor";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import {
  PROPERTY_SECTION_DIVIDER_CLASS,
  PROPERTY_SECTION_TITLE_CLASS,
} from "./propertyEditorStyles";

interface INetworkWebStoryPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
}

/**
 * General-tab editor for Network Web Story (title + visual settings).
 * Field mappings live in {@link NetworkWebStoryFieldMappingsPanel} below Bindings.
 */
export const NetworkWebStoryPropertyEditor: FC<
  INetworkWebStoryPropertyEditorProps
> = ({ component, onPropertyChange }) => {
  const props = component.props as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title"
        value={(props.title as string) || "Network Web Story"}
        onChange={(val) => onPropertyChange("title", val)}
      />

      <div className={PROPERTY_SECTION_DIVIDER_CLASS}>
        <p className={PROPERTY_SECTION_TITLE_CLASS}>Visual settings</p>
        <SelectPropertyEditor
          label="Layout algorithm"
          value={(props.layoutAlgorithm as string) || "force"}
          options={[
            { value: "force", label: "Force" },
            { value: "radial", label: "Radial" },
          ]}
          onChange={(val) => onPropertyChange("layoutAlgorithm", val)}
        />
        <SelectPropertyEditor
          label="Node size by"
          value={(props.nodeSizeBy as string) || "degree"}
          options={[
            { value: "degree", label: "Degree" },
            { value: "value", label: "Value" },
            { value: "none", label: "None" },
          ]}
          onChange={(val) => onPropertyChange("nodeSizeBy", val)}
        />
        <SelectPropertyEditor
          label="Node color by"
          value={(props.nodeColorBy as string) || "category"}
          options={[
            { value: "category", label: "Category" },
            { value: "health_score", label: "Health score" },
            { value: "risk_score", label: "Risk score" },
          ]}
          onChange={(val) => onPropertyChange("nodeColorBy", val)}
        />
        <SelectPropertyEditor
          label="Edge width by"
          value={(props.edgeWidthBy as string) || "weight"}
          options={[
            { value: "weight", label: "Weight" },
            { value: "value", label: "Edge value" },
            { value: "frequency", label: "Frequency" },
            { value: "none", label: "None" },
          ]}
          onChange={(val) => onPropertyChange("edgeWidthBy", val)}
        />
        <SelectPropertyEditor
          label="Edge color by"
          value={(props.edgeColorBy as string) || "relationship_type"}
          options={[
            { value: "relationship_type", label: "Relationship type" },
            { value: "risk_score", label: "Risk score" },
            { value: "status", label: "Status" },
            { value: "none", label: "None" },
          ]}
          onChange={(val) => onPropertyChange("edgeColorBy", val)}
        />
        <BooleanPropertyEditor
          label="Show arrows"
          value={typeof props.showArrows === "boolean" ? props.showArrows : true}
          onChange={(val) => onPropertyChange("showArrows", val)}
        />
        <NumberPropertyEditor
          label="Highlight depth"
          value={
            typeof props.highlightDepth === "number" ? props.highlightDepth : 1
          }
          min={1}
          max={3}
          step={1}
          onChange={(val) => onPropertyChange("highlightDepth", val)}
        />
        <NumberPropertyEditor
          label="Min weight filter"
          value={
            typeof props.minWeightFilter === "number"
              ? props.minWeightFilter
              : 0
          }
          min={0}
          step={1}
          onChange={(val) => onPropertyChange("minWeightFilter", val)}
        />
        <NumberPropertyEditor
          label="Max nodes"
          value={typeof props.maxNodes === "number" ? props.maxNodes : 300}
          min={10}
          max={500}
          step={10}
          onChange={(val) => onPropertyChange("maxNodes", val)}
        />
        <NumberPropertyEditor
          label="Max edges"
          value={typeof props.maxEdges === "number" ? props.maxEdges : 800}
          min={10}
          max={2000}
          step={10}
          onChange={(val) => onPropertyChange("maxEdges", val)}
        />
      </div>
    </div>
  );
};