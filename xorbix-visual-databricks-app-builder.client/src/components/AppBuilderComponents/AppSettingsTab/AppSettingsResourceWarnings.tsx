import type { AppSettingsWarning } from "../../../models/DatabricksAppModels";

interface AppSettingsResourceWarningsProps {
  warnings: AppSettingsWarning[];
  /** e.g. read-only table omits tabIndex for nested focus */
  tabIndex?: 0 | -1;
}

/**
 * Shared “resource mapping notices” banner for the app resources read-only table and edit mode.
 */
export default function AppSettingsResourceWarnings({
  warnings,
  tabIndex = 0,
}: AppSettingsResourceWarningsProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-md border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-foreground"
      role="status"
      aria-live="polite"
      tabIndex={tabIndex}
    >
      <p className="font-medium">Resource mapping notices</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {warnings.map((w, i) => (
          <li key={`${w.code}-${i}`}>{w.message}</li>
        ))}
      </ul>
    </div>
  );
}
