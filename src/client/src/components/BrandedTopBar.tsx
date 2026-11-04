import { Link } from "react-router-dom";
import { VDAB_LOGO_URL } from "../constants/authBranding";
import { cn } from "../lib/utils";
import { ThemeToggle } from "./ThemeToggle";

export type BrandedTopBarVariant =
  | "apps"
  | "builder";

interface BrandedTopBarProps {
  readonly variant: BrandedTopBarVariant;
  /** App name next to the logo; used when variant is `builder`. */
  readonly builderAppTitle?: string;
  /** Workspace identity shown to the installed App user. */
  readonly workspaceUserLabel?: string;
  /** Full workspace identity used for the account label tooltip. */
  readonly workspaceUserTitle?: string;
}

/** Renders the product header and the current workspace identity. */
export function BrandedTopBar({
  variant,
  builderAppTitle = "",
  workspaceUserLabel = "Databricks user",
  workspaceUserTitle = workspaceUserLabel,
}: Readonly<BrandedTopBarProps>) {
  return (
    <header
      className={cn(
        "chrome-inside-blue-glow chrome-inside-blue-glow--no-sides shell-header-chrome flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-white/20 px-4 text-white md:gap-3 md:px-5",
      )}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <Link
          to="/apps"
          className="flex shrink-0 items-center"
          aria-label="Home"
        >
          <img
            src={VDAB_LOGO_URL}
            alt="VDAB"
            className="h-8 w-auto max-w-[200px] object-contain brightness-0 invert"
          />
        </Link>
        {variant === "builder" && builderAppTitle ? (
          <>
            <span
              className="hidden h-6 w-px shrink-0 bg-white/25 sm:block"
              aria-hidden
            />
            <span
              className="min-w-0 truncate text-sm font-semibold text-white/95 sm:text-base"
              title={builderAppTitle}
            >
              {builderAppTitle}
            </span>
          </>
        ) : null}
      </div>

      {variant === "builder" && <div className="min-w-0 flex-1" aria-hidden />}

      <div className="ml-auto flex min-w-0 items-center gap-1">
        <div
          className="hidden min-w-0 max-w-64 items-center gap-2 border-l border-white/20 pl-3 text-white sm:flex"
          role="group"
          aria-label="Signed-in Databricks user"
          title={workspaceUserTitle}
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-medium"
          >
            {workspaceUserLabel.trim().charAt(0).toUpperCase() || "D"}
          </span>
          <span className="truncate text-sm font-medium">
            {workspaceUserLabel}
          </span>
        </div>
        <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
      </div>
    </header>
  );
}
