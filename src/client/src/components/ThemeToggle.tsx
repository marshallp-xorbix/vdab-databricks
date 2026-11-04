import { Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface IThemeToggleProps {
  readonly className?: string;
  /** Compact icon button vs labeled control for menus. */
  readonly variant?: "icon" | "menu";
}

/**
 * Dark / Light appearance toggle. Preference is stored in localStorage.
 */
export function ThemeToggle({
  className,
  variant = "icon",
}: IThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (variant === "menu") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-3 py-2",
          className,
        )}
        role="group"
        aria-label="Appearance"
      >
        <span className="text-sm text-muted-foreground">Appearance</span>
        <div className="inline-flex rounded-full border border-border p-0.5">
          <ThemePill
            label="Dark"
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
          />
          <ThemePill
            label="Light"
            active={theme === "light"}
            onClick={() => setTheme("light")}
          />
        </div>
      </div>
    );
  }

  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "text-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      onClick={() => setTheme(nextTheme)}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      title={theme === "dark" ? "Light theme" : "Dark theme"}
    >
      {theme === "dark" ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </Button>
  );
}

interface IThemePillProps {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}

function ThemePill({ label, active, onClick }: IThemePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
