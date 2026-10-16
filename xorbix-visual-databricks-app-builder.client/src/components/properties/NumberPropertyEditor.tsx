import type { FC } from "react";
import { cn } from "../../lib/utils";
import {
  PROPERTY_CONTROL_CLASS,
  PROPERTY_CONTROL_ERROR_CLASS,
  PROPERTY_CONTROL_VALID_CLASS,
  PROPERTY_ERROR_CLASS,
  PROPERTY_FIELD_LABEL_CLASS,
} from "./propertyEditorStyles";

interface NumberPropertyEditorProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  onChange: (value: number) => void;
}

export const NumberPropertyEditor: FC<NumberPropertyEditorProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  error,
  onChange,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  return (
    <div>
      <label className={PROPERTY_FIELD_LABEL_CLASS}>{label}</label>
      <input
        type="number"
        value={value || 0}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        className={cn(
          PROPERTY_CONTROL_CLASS,
          error ? PROPERTY_CONTROL_ERROR_CLASS : PROPERTY_CONTROL_VALID_CLASS,
        )}
      />
      {error ? <p className={PROPERTY_ERROR_CLASS}>{error}</p> : null}
    </div>
  );
};
