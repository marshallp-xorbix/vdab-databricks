import { useEffect, useState, type FC } from "react";
import { SelectPropertyEditor } from "./SelectPropertyEditor";
import { StringPropertyEditor } from "./StringPropertyEditor";

interface DataWindowPlaceholderPropertyEditorProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

type PlaceholderMode = "none" | "custom";

const getPlaceholderMode = (value: string | null): PlaceholderMode => {
  if (value === null) {
    return "none";
  }

  return "custom";
};

export const DataWindowPlaceholderPropertyEditor: FC<
  DataWindowPlaceholderPropertyEditorProps
> = ({ label, value, onChange }) => {
  const [mode, setMode] = useState<PlaceholderMode>(getPlaceholderMode(value));

  useEffect(() => {
    setMode(getPlaceholderMode(value));
  }, [value]);

  return (
    <div className="space-y-2">
      <SelectPropertyEditor
        label={label}
        value={mode}
        options={[
          { value: "none", label: "None (Streamlit default)" },
          { value: "custom", label: "Custom" },
        ]}
        placeholder=""
        onChange={(newMode) => {
          const selectedMode = newMode as PlaceholderMode;
          setMode(selectedMode);

          switch (selectedMode) {
            case "none":
              onChange(null);
              break;
            case "custom":
              // Keep current custom value as-is. Do not force empty string.
              break;
            default:
              onChange(value);
              break;
          }
        }}
      />

      {mode === "custom" && (
        <StringPropertyEditor
          label="Custom Placeholder Text"
          value={value ?? ""}
          placeholder="Enter text for missing values"
          onChange={(newValue) => onChange(newValue)}
        />
      )}
    </div>
  );
};
