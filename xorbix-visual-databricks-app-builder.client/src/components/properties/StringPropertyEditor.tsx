import { useId, type FC } from "react";
import { cn } from "../../lib/utils";
import {
  PROPERTY_CONTROL_CLASS,
  PROPERTY_CONTROL_ERROR_CLASS,
  PROPERTY_CONTROL_VALID_CLASS,
  PROPERTY_ERROR_CLASS,
  PROPERTY_FIELD_LABEL_CLASS,
} from "./propertyEditorStyles";

interface StringPropertyEditorProps {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}

export const StringPropertyEditor: FC<StringPropertyEditorProps> = ({
  label,
  value,
  placeholder,
  error,
  onChange,
}) => {
  const inputId = useId();

  return (
    <div>
      <label htmlFor={inputId} className={PROPERTY_FIELD_LABEL_CLASS}>{label}</label>
      <input
        id={inputId}
        type="text"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          PROPERTY_CONTROL_CLASS,
          error ? PROPERTY_CONTROL_ERROR_CLASS : PROPERTY_CONTROL_VALID_CLASS,
        )}
      />
      {error ? <p className={PROPERTY_ERROR_CLASS}>{error}</p> : null}
    </div>
  );
};
