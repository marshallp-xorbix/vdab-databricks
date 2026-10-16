import type { FC } from "react";
import { cn } from "../../lib/utils";
import {
  PROPERTY_ERROR_CLASS,
  PROPERTY_INLINE_LABEL_CLASS,
} from "./propertyEditorStyles";

interface BooleanPropertyEditorProps {
  label: string;
  value: boolean;
  error?: string;
  onChange: (value: boolean) => void;
}

export const BooleanPropertyEditor: FC<BooleanPropertyEditorProps> = ({
  label,
  value,
  error,
  onChange,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className={PROPERTY_INLINE_LABEL_CLASS}>{label}</label>
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            "h-4 w-4 rounded bg-muted text-primary focus:ring-2 focus:ring-primary",
            error ? "border-destructive" : "border-border",
          )}
        />
      </div>
      {error ? <p className={PROPERTY_ERROR_CLASS}>{error}</p> : null}
    </div>
  );
};
