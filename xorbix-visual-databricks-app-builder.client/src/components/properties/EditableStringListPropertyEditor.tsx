import { type FC, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  PROPERTY_ERROR_CLASS,
  PROPERTY_FIELD_LABEL_CLASS,
} from "./propertyEditorStyles";

interface EditableStringListPropertyEditorProps {
  label: string;
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onItemChange: (index: number, value: string) => void;
  addButtonLabel?: string;
  getPlaceholder?: (index: number) => string;
  getAriaLabel?: (index: number) => string;
  errors?: Record<number, string>;
  showRemoveButton?: (index: number, totalItems: number) => boolean;
}

export const EditableStringListPropertyEditor: FC<
  EditableStringListPropertyEditorProps
> = ({
  label,
  items,
  onAdd,
  onRemove,
  onItemChange,
  addButtonLabel = "Add Item",
  getPlaceholder,
  getAriaLabel,
  errors = {},
  showRemoveButton = () => true,
}) => {
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const previousCountRef = useRef<number>(items.length);

  useEffect(() => {
    if (items.length > previousCountRef.current) {
      requestAnimationFrame(() => {
        const container = listContainerRef.current;
        if (!container) {
          return;
        }

        const lastItem = container.lastElementChild as HTMLElement | null;
        if (lastItem) {
          lastItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    }

    previousCountRef.current = items.length;
  }, [items.length]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={PROPERTY_FIELD_LABEL_CLASS}>{label}</label>
        <Button
          type="button"
          size="sm"
          onClick={onAdd}
          className="h-7 px-2.5 text-xs"
        >
          {addButtonLabel}
        </Button>
      </div>

      <div
        ref={listContainerRef}
        className="max-h-52 divide-y divide-border overflow-y-auto rounded-md bg-muted"
      >
        {items.map((itemValue, index) => {
          const hasError = !!errors[index];
          return (
            <div key={`${label}-item-${index}`}>
              <div className="flex items-center gap-1 px-2 py-1">
                <Input
                  type="text"
                  value={itemValue}
                  aria-label={
                    getAriaLabel ? getAriaLabel(index) : `${label} ${index + 1}`
                  }
                  placeholder={
                    getPlaceholder
                      ? getPlaceholder(index)
                      : `${label} ${index + 1}`
                  }
                  onChange={(event) => onItemChange(index, event.target.value)}
                  className={`border-0 shadow-none focus-visible:ring-0 bg-transparent ${
                    hasError ? "text-destructive placeholder:text-destructive" : ""
                  }`}
                />
                {showRemoveButton(index, items.length) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-transparent"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove ${label} ${index + 1}`}
                  >
                    ×
                  </Button>
                )}
              </div>
              {hasError && (
                <p className={`${PROPERTY_ERROR_CLASS} px-2 pb-1`}>
                  {errors[index]}
                </p>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="px-3 py-3 text-xs text-muted-foreground text-center">
            No items yet
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableStringListPropertyEditor;
