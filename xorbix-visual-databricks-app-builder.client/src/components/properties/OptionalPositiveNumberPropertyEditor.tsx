import { useEffect, useId, useState, type FC } from "react";
import { cn } from "../../lib/utils";
import {
  PROPERTY_CONTROL_CLASS,
  PROPERTY_CONTROL_ERROR_CLASS,
  PROPERTY_FIELD_LABEL_CLASS,
  PROPERTY_HINT_CLASS,
} from "./propertyEditorStyles";

interface OptionalPositiveNumberPropertyEditorProps {
  label: string;
  value?: number;
  onChange: (value: number) => void;
}

export const OptionalPositiveNumberPropertyEditor: FC<
  OptionalPositiveNumberPropertyEditorProps
> = ({ label, value, onChange }) => {
  const inputId = useId();
  const [inputValue, setInputValue] = useState<string>(
    value && value > 0 ? String(value) : "",
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setInputValue(value && value > 0 ? String(value) : "");
  }, [value]);

  const handleChange = (nextValue: string) => {
    setInputValue(nextValue);

    const trimmedValue = nextValue.trim();
    if (trimmedValue.length === 0) {
      setError("");
      onChange(0);
      return;
    }
    // TODO: Generalize component so its not only scoped to Max Rows for tables
    const parsedValue = Number(trimmedValue);
    if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
      setError("Max Rows must be a whole number.");
      return;
    }

    if (parsedValue <= 0) {
      setError("Max Rows must be greater than 0, or leave blank for all rows.");
      return;
    }

    setError("");
    onChange(parsedValue);
  };

  return (
    <div>
      <label htmlFor={inputId} className={PROPERTY_FIELD_LABEL_CLASS}>{label}</label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        value={inputValue}
        placeholder="Leave blank for all rows"
        onChange={(event) => handleChange(event.target.value)}
        className={cn(
          PROPERTY_CONTROL_CLASS,
          error
            ? PROPERTY_CONTROL_ERROR_CLASS
            : "border-border focus:ring-primary",
        )}
      />
      <p
        className={cn(
          "mt-0.5 text-xs",
          error ? "text-destructive" : PROPERTY_HINT_CLASS,
        )}
      >
        {error ||
          "Optional. Leave blank for all rows, or enter a number greater than 0."}
      </p>
    </div>
  );
};
