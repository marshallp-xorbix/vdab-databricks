import type { AppThemeColorKey } from "./themeDefaults";
import {
  getStreamlitThemeDefaults,
  normalizeHexColor,
} from "./themeDefaults";
import { useTheme } from "../../../context/ThemeContext";

interface AppThemeTabProps {
  appTheme: Record<string, string>;
  onThemeColorChange: (key: AppThemeColorKey, value: string) => void;
}

export default function AppThemeTab({
  appTheme,
  onThemeColorChange,
}: AppThemeTabProps) {
  const { theme } = useTheme();
  const defaults = getStreamlitThemeDefaults(theme);

  const primaryColor = normalizeHexColor(
    appTheme.primaryColor,
    defaults.primaryColor,
  );
  const backgroundColor = normalizeHexColor(
    appTheme.backgroundColor,
    defaults.backgroundColor,
  );
  const secondaryBackgroundColor = normalizeHexColor(
    appTheme.secondaryBackgroundColor,
    defaults.secondaryBackgroundColor,
  );
  const textColor = normalizeHexColor(
    appTheme.textColor,
    defaults.textColor,
  );

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--card-shadow)]">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Theme
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-1 block font-medium text-foreground">
            Primary Color
          </label>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => onThemeColorChange("primaryColor", e.target.value)}
            className="h-10 w-full cursor-pointer rounded border border-border"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-foreground">
            Background Color
          </label>
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => onThemeColorChange("backgroundColor", e.target.value)}
            className="h-10 w-full cursor-pointer rounded border border-border"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-foreground">
            Secondary Background Color
          </label>
          <input
            type="color"
            value={secondaryBackgroundColor}
            onChange={(e) =>
              onThemeColorChange("secondaryBackgroundColor", e.target.value)
            }
            className="h-10 w-full cursor-pointer rounded border border-border"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-foreground">
            Text Color
          </label>
          <input
            type="color"
            value={textColor}
            onChange={(e) => onThemeColorChange("textColor", e.target.value)}
            className="h-10 w-full cursor-pointer rounded border border-border"
          />
        </div>
      </div>
    </section>
  );
}
