import { useId, type FC } from "react";
import { cn } from "../../lib/utils";
import {
  PROPERTY_CONTROL_CLASS,
  PROPERTY_CONTROL_ERROR_CLASS,
  PROPERTY_CONTROL_VALID_CLASS,
  PROPERTY_ERROR_CLASS,
  PROPERTY_FIELD_LABEL_CLASS,
} from "./propertyEditorStyles";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectPropertyEditorProps {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}

export const SelectPropertyEditor: FC<SelectPropertyEditorProps> = ({
  label,
  value,
  options,
  placeholder = "Select an option...",
  error,
  onChange,
}) => {
  const selectId = useId();

  return (
    <div>
      <label htmlFor={selectId} className={PROPERTY_FIELD_LABEL_CLASS}>{label}</label>
      <select
        id={selectId}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          PROPERTY_CONTROL_CLASS,
          error ? PROPERTY_CONTROL_ERROR_CLASS : PROPERTY_CONTROL_VALID_CLASS,
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className={PROPERTY_ERROR_CLASS}>{error}</p> : null}
    </div>
  );
};
