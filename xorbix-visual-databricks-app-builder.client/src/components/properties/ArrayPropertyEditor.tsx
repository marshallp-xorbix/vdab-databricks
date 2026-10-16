import type { FC } from "react";
import { useEffect, useState } from "react";
import { EditableStringListPropertyEditor } from "./EditableStringListPropertyEditor";

interface DropdownOptionDto {
  value: string;
}

interface ArrayPropertyEditorProps {
  label: string;
  value: DropdownOptionDto[];
  onChange: (value: DropdownOptionDto[]) => void;
  isDropdownOptions?: boolean;
  error?: string;
}

export const ArrayPropertyEditor: FC<ArrayPropertyEditorProps> = ({
  label,
  value,
  onChange,
  isDropdownOptions = false,
  error,
}) => {
  const defaultOptions: DropdownOptionDto[] = isDropdownOptions
    ? [{ value: "Option 1" }, { value: "Option 2" }]
    : [];

  const [items, setItems] = useState<DropdownOptionDto[]>(
    value?.length ? value : defaultOptions,
  );

  useEffect(() => {
    setItems(value?.length ? value : defaultOptions);
  }, [value, isDropdownOptions]);

  const addItem = () => {
    const newItems = [...items, { value: "" }];
    setItems(newItems);
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    onChange(newItems);
  };

  const updateItem = (index: number, newValue: string) => {
    const newItems = items.map((item, i) =>
      i === index ? { value: newValue } : item,
    );
    setItems(newItems);
    onChange(newItems);
  };

  const itemValues = items.map((item) => item.value ?? "");

  return (
    <div className="space-y-2">
      <EditableStringListPropertyEditor
        label={label}
        items={itemValues}
        onAdd={addItem}
        onRemove={removeItem}
        onItemChange={updateItem}
        addButtonLabel="Add Item"
        getPlaceholder={() => "Value"}
        getAriaLabel={(index) => `${label} ${index + 1}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
