import type { ChangeEvent, FC } from "react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import {
  PROPERTY_CONTROL_CLASS,
  PROPERTY_CONTROL_ERROR_CLASS,
  PROPERTY_CONTROL_VALID_CLASS,
  PROPERTY_ERROR_CLASS,
  PROPERTY_FIELD_LABEL_CLASS,
} from "./propertyEditorStyles";

interface IHeightPixelsPropertyEditorProps {
  label: string;
  value: unknown;
  step?: number;
  error?: string;
  onChange: (value: number | undefined) => void;
}

function toInputValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value));
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

export const HeightPixelsPropertyEditor: FC<
  Readonly<IHeightPixelsPropertyEditorProps>
> = ({ label, value, step = 10, error, onChange }) => {
  const [inputValue, setInputValue] = useState(() => toInputValue(value));

  useEffect(() => {
    setInputValue(toInputValue(value));
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setInputValue(nextValue);

    if (nextValue.trim().length === 0) {
      onChange(undefined);
      return;
    }

    const parsedValue = Number(nextValue);
    if (Number.isFinite(parsedValue)) {
      onChange(parsedValue);
    }
  };

  return (
    <div>
      <label className={PROPERTY_FIELD_LABEL_CLASS}>{label}</label>
      <input
        type="number"
        value={inputValue}
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
