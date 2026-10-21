import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface IWorkspaceResourceOption {
  value: string;
  label: string;
}

interface IInstalledWorkspaceResourceSelectProps {
  label: string;
  value: string;
  placeholder: string;
  options: readonly IWorkspaceResourceOption[];
  loading: boolean;
  error: Error | null;
  disabled?: boolean;
  emptyLabel?: string;
  onChange: (next: string) => void;
}

const SELECT_DISABLED = {
  loading: "__loading__",
  empty: "__empty__",
  error: "__error__",
};

/** Renders one accessible selector for a current-workspace resource. */
export default function InstalledWorkspaceResourceSelect({
  label,
  value,
  placeholder,
  options,
  loading,
  error,
  disabled = false,
  emptyLabel = `No ${label.toLowerCase()} found`,
  onChange,
}: Readonly<IInstalledWorkspaceResourceSelectProps>) {
  const selectedValue = options.some((option) => option.value === value) ? value : undefined;
  const errorMessage = error?.message;

  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-sm">{label}</Label>
      <Select
        value={selectedValue}
        onValueChange={onChange}
        disabled={disabled || loading || Boolean(errorMessage)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={loading ? `Loading ${label.toLowerCase()}…` : placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-60 overflow-y-auto">
          {loading ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>Loading…</SelectItem>
          ) : errorMessage ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>{errorMessage}</SelectItem>
          ) : options.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.empty} disabled>{emptyLabel}</SelectItem>
          ) : (
            options.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {errorMessage && <p role="alert" className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}
