import { Label } from "./ui/label";

interface IDataWindowResourceSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  isPending: boolean;
  error: string | null;
  emptyMessage: string;
  onChange: (value: string) => void;
}

/** Renders one labeled resource selector with loading and error states. */
export default function DataWindowResourceSelect({
  id,
  label,
  value,
  options,
  disabled,
  isPending,
  error,
  emptyMessage,
  onChange,
}: Readonly<IDataWindowResourceSelectProps>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select a {label.toLowerCase()}</option>
        {options.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      {isPending && <p role="status" className="text-xs text-muted-foreground">Loading {label.toLowerCase()}…</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {!isPending && !error && options.length === 0 && (
        <p role="status" className="text-xs text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  );
}
