import type { FC } from "react";
import type { VdabComponent } from "../../types/components";
import {
  ComponentType,
  TextInputType,
} from "../../types/components/componentTypes";
import {
  StringPropertyEditor,
  BooleanPropertyEditor,
  NumberPropertyEditor,
  OptionalPositiveNumberPropertyEditor,
  ArrayPropertyEditor,
  DropdownPropertyEditor,
  SelectPropertyEditor,
  DataWindowPlaceholderPropertyEditor,
} from "./index";
import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import { tryRenderSpecializedPropertyEditor } from "./specializedPropertyEditors";

interface PropertyEditorFactoryProps {
  component: VdabComponent;
  components?: VdabComponent[];
  propertyErrors?: Record<string, string | undefined>;
  onPropertyChange: (key: string, value: unknown) => void;
  onDeleteTab?: (componentId: string, tabIndex: number) => void;
  workspaceUrl?: string | null;
  normalizedAppResources?: NormalizedAppResource[];
}

interface DropdownOptionDto {
  value: string;
}

export const PropertyEditorFactory: FC<PropertyEditorFactoryProps> = ({
  component,
  components = [],
  propertyErrors = {},
  onPropertyChange,
  onDeleteTab,
  workspaceUrl = null,
  normalizedAppResources = [],
}) => {
  const specialized = tryRenderSpecializedPropertyEditor({
    component,
    components,
    onPropertyChange,
    onDeleteTab,
    workspaceUrl,
    normalizedAppResources,
  });
  if (specialized) {
    return specialized;
  }

  // TODO: Refactor to use property schema system for better extensibility and type safety.
  // Property schema would define editor types, validation rules, and options centrally
  // instead of hardcoded component-type + property-name combinations. This would make it
  // easier to add new select properties, validate property values, and maintain consistency
  // across components while reducing tech debt from scattered property definitions.

  // Helper function to determine if a property should be a select dropdown
  const shouldUseSelectEditor = (
    key: string,
    componentType: string,
  ): boolean => {
    // Define which component types and properties should use select dropdowns
    const selectProperties: Record<string, string[]> = {
      Button: ["variant"],
      Label: ["fontSize"],
      Form: ["width", "height"],
      DataWindow: ["width", "height"],
      EditableDataWindow: ["width", "height", "numRows"],
      // Future: Add other component types and their select properties
      // TextInput: ['inputType'],
      // etc.
    };

    return selectProperties[componentType]?.includes(key) || false;
  };

  // Helper function to get options for select properties
  const getSelectOptions = (key: string, componentType: string) => {
    // Define options for each component type + property combination
    const propertyOptions: Record<
      string,
      Record<string, Array<{ value: string; label: string }>>
    > = {
      Button: {
        variant: [
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
        ],
      },
      Label: {
        fontSize: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
      },
      Form: {
        width: [
          { value: "stretch", label: "Stretch" },
          { value: "content", label: "Content" },
        ],
        height: [
          { value: "content", label: "Content" },
          { value: "stretch", label: "Stretch" },
        ],
      },
      DataWindow: {
        width: [
          { value: "stretch", label: "Stretch" },
          { value: "content", label: "Content" },
        ],
        height: [
          { value: "auto", label: "Auto" },
          { value: "content", label: "Content" },
          { value: "stretch", label: "Stretch" },
        ],
      },
      EditableDataWindow: {
        width: [
          { value: "stretch", label: "Stretch" },
          { value: "content", label: "Content" },
        ],
        height: [
          { value: "auto", label: "Auto" },
          { value: "content", label: "Content" },
          { value: "stretch", label: "Stretch" },
        ],
        numRows: [
          { value: "fixed", label: "Fixed" },
          { value: "dynamic", label: "Dynamic" },
          { value: "add", label: "Add" },
          { value: "delete", label: "Delete" },
        ],
      },
      // Future: Add options for other properties
    };

    return propertyOptions[componentType]?.[key] || [];
  };

  // Helper function to determine the appropriate editor based on property value type
  const renderPropertyEditor = (key: string, value: unknown) => {
    const valueType = typeof value;

    if (
      key === "maxRows" &&
      (component.type === ComponentType.DataWindow ||
        component.type === ComponentType.EditableDataWindow)
    ) {
      return (
        <OptionalPositiveNumberPropertyEditor
          key={key}
          label={formatPropertyLabel(key)}
          value={typeof value === "number" ? value : 0}
          onChange={(newValue) => onPropertyChange(key, newValue)}
        />
      );
    }

    if (
      key === "placeholder" &&
      (component.type === ComponentType.DataWindow ||
        component.type === ComponentType.EditableDataWindow)
    ) {
      return (
        <DataWindowPlaceholderPropertyEditor
          key={key}
          label={formatPropertyLabel(key)}
          value={value as string | null}
          onChange={(newValue) => onPropertyChange(key, newValue)}
        />
      );
    }

    if (
      key === "hideIndex" &&
      (component.type === ComponentType.DataWindow ||
        component.type === ComponentType.EditableDataWindow)
    ) {
      const normalizedValue =
        value === null
          ? "__none"
          : value === true
            ? "true"
            : value === false
              ? "false"
              : "__none";

      return (
        <SelectPropertyEditor
          key={key}
          label={formatPropertyLabel(key)}
          value={normalizedValue}
          options={[
            { value: "__none", label: "None" },
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ]}
          placeholder=""
          onChange={(newValue) => {
            if (newValue === "__none") {
              onPropertyChange(key, null);
              return;
            }

            onPropertyChange(key, newValue === "true");
          }}
        />
      );
    }

    if (
      key === "defaultValue" &&
      component.type === ComponentType.Dropdown
    ) {
      return (
        <DropdownPropertyEditor
          label={formatPropertyLabel(key)}
          options={(component.props.options as DropdownOptionDto[]) ?? []}
          value={value as string | undefined}
          onChange={(newValue) => onPropertyChange(key, newValue)}
          error={propertyErrors[key]}
        />
      );
    }
    // Slider nuances
    if (
      key === "upperValue" &&
      component.type === ComponentType.Slider &&
      component.props.ranged !== true
    ) {
      return undefined;
    }

    if (
      component.type === ComponentType.Slider &&
      key === "defaultValue" &&
      component.props.ranged === true
    ) {
      return (
          <NumberPropertyEditor
            key={key}
            label={"Lower Value"}
            value={value as number}
            error={propertyErrors[key]}
            onChange={(newValue) => onPropertyChange(key, newValue)}
          />
        );
    }
    // Text Input Nuances
    if (
      component.type === ComponentType.TextInput &&
      key === "height" &&
      component.props.multiline !== true
    ) {
      return undefined;
    }

    if (
      component.type === ComponentType.TextInput &&
      key === "type" &&
      component.props.multiline !== false
    ) {
      return undefined;
    }

    if (
      component.type === ComponentType.TextInput &&
      key === "type" &&
      component.props.multiline === false
    ) {
      return (
        <DropdownPropertyEditor
          label={formatPropertyLabel(key)}
          options={[
            { value: TextInputType.Default },
            { value: TextInputType.Password },
          ]}
          value={value as string | undefined}
          onChange={(newValue) => onPropertyChange(key, newValue)}
          error={propertyErrors[key]}
        />
      );
    }

    // Handle arrays (like dropdown options)
    if (Array.isArray(value)) {
      const isDropdownOptions = key === "options";
      if (isDropdownOptions) {
        return (
          <ArrayPropertyEditor
            key={key}
            label={formatPropertyLabel(key)}
            value={value}
            onChange={(newValue) => onPropertyChange(key, newValue)}
            isDropdownOptions={isDropdownOptions}
            error={propertyErrors[key]}
          />
        );
      }
      // For other arrays, show as JSON for now
      return (
        <StringPropertyEditor
          key={key}
          label={formatPropertyLabel(key)}
          value={JSON.stringify(value, null, 2)}
          placeholder={`Enter ${formatPropertyLabel(key).toLowerCase()}...`}
          onChange={(newValue) => {
            try {
              onPropertyChange(key, JSON.parse(newValue));
            } catch {
              onPropertyChange(key, newValue);
            }
          }}
        />
      );
    }

    // Check if this should be a select dropdown
    if (valueType === "string" && shouldUseSelectEditor(key, component.type)) {
      const options = getSelectOptions(key, component.type);
      if (options.length > 0) {
        return (
          <SelectPropertyEditor
            key={key}
            label={formatPropertyLabel(key)}
            value={value as string || ""}
            options={options}
            error={propertyErrors[key]}
            onChange={(newValue) => onPropertyChange(key, newValue)}
          />
        );
      }
    }

    // Handle other value types
    switch (valueType) {
      case "string":
        return (
          <StringPropertyEditor
            key={key}
            label={formatPropertyLabel(key)}
            value={value as string}
            placeholder={`Enter ${formatPropertyLabel(key).toLowerCase()}...`}
            error={propertyErrors[key]}
            onChange={(newValue) => onPropertyChange(key, newValue)}
          />
        );
      case "boolean":
        return (
          <BooleanPropertyEditor
            key={key}
            label={formatPropertyLabel(key)}
            value={value as boolean}
            error={propertyErrors[key]}
            onChange={(newValue) => onPropertyChange(key, newValue)}
          />
        );
      case "number":
        return (
          <NumberPropertyEditor
            key={key}
            label={formatPropertyLabel(key)}
            value={value as number}
            error={propertyErrors[key]}
            onChange={(newValue) => onPropertyChange(key, newValue)}
          />
        );
      default:
        // For complex objects or unknown types, show as JSON string for now
        return (
          <StringPropertyEditor
            key={key}
            label={formatPropertyLabel(key)}
            value={JSON.stringify(value, null, 2)}
            onChange={(newValue) => {
              try {
                onPropertyChange(key, JSON.parse(newValue));
              } catch {
                onPropertyChange(key, newValue);
              }
            }}
          />
        );
    }
  };

  // Helper function to format property keys into readable labels
  const formatPropertyLabel = (key: string): string => {
    if (component.type === ComponentType.Label && key === "fontSize") {
      return "Size";
    }

    // Convert camelCase to Title Case with spaces
    return key
      .replace(/([A-Z])/g, " $1") // Add space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim(); // Remove leading/trailing spaces
  };

  const properties =
    component.type === ComponentType.Label
      ? { fontSize: "medium", ...(component.props || {}) }
      : component.props || {};

  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([key, value]) => {
        return renderPropertyEditor(key, value);
      })}
    </div>
  );
};
