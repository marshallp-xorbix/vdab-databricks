import type { FC } from "react";

interface DropdownOptionDto {
  value: string;
}

interface DropdownPropertyEditorProps {
  label: string;
  options: DropdownOptionDto[];
  value?: string;
  onChange: (value?: string) => void;
  error?: string;
}

export const DropdownPropertyEditor: FC<DropdownPropertyEditorProps> = ({
  label,
  options,
  value,
  onChange,
  error,
}) => {
  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selected = e.target.value;
    onChange(selected === "" ? undefined : selected);
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">
        {label}
      </label>

      <select
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        value={value ?? ""}
        onChange={handleChange}
      >
        <option value="">None</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
