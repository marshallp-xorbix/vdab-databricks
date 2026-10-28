import { Link } from "react-router-dom";
import { VDAB_LOGO_URL } from "../constants/authBranding";
import { cn } from "../lib/utils";
import { SidebarTrigger } from "./ui/sidebar";
import GuestAuthActions from "./GuestAuthActions";
import SetupAuthActions from "./SetupAuthActions";
import SignedInAccountRail from "./SignedInAccountRail";
import { Breadcrumb } from "./Breadcrumb";
import { ThemeToggle } from "./ThemeToggle";

export type BrandedTopBarVariant =
  | "guest"
  | "apps"
  | "admin"
  | "builder"
  | "setup"
  | "authenticated";

interface BrandedTopBarProps {
  readonly variant: BrandedTopBarVariant;
  /** App name next to the logo; used when variant is `builder`. */
  readonly builderAppTitle?: string;
  /** Workspace identity shown instead of SaaS account controls in standalone mode. */
  readonly workspaceUserLabel?: string;
  /** Full workspace identity retained for the account label tooltip. */
  readonly workspaceUserTitle?: string;
  /** Hides SaaS identity controls in workspace-installed mode. */
  readonly showAccountRail?: boolean;
  /** Hides the mobile sidebar trigger when the shell owns a different rail. */
  readonly showSidebarTrigger?: boolean;
}

/**
 * Full-width shell header with VDAB logo. Guest: public auth flows + theme toggle.
 * Apps/Admin/Builder: signed-in shell (mobile sidebar trigger + account rail).
 */
export function BrandedTopBar({
  variant,
  builderAppTitle = "",
  workspaceUserLabel = "Databricks user",
  workspaceUserTitle = workspaceUserLabel,
  showAccountRail = true,
  showSidebarTrigger = true,
}: Readonly<BrandedTopBarProps>) {
  const logoLink = variant === "guest" || variant === "setup" ? "/" : "/apps";

  return (
    <header
      className={cn(
        "chrome-inside-blue-glow chrome-inside-blue-glow--no-sides shell-header-chrome flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-white/20 px-4 text-white md:gap-3 md:px-5",
      )}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        {showSidebarTrigger && (variant === "apps" || variant === "admin" || variant === "builder") ? (
          <SidebarTrigger className="-ml-1 text-white hover:bg-white/10 md:hidden" />
        ) : null}
        <Link
          to={logoLink}
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

      {(variant === "apps" ||
        variant === "admin" ||
        variant === "authenticated") && <Breadcrumb />}
      {variant === "builder" && <div className="min-w-0 flex-1" aria-hidden />}

      {variant === "guest" || variant === "setup" || !showAccountRail ? (
        <div className="ml-auto flex items-center gap-1">
          {(variant === "builder" || variant === "apps") && !showAccountRail && (
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
          )}
          <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
          {showAccountRail ? (variant === "setup" ? <SetupAuthActions /> : <GuestAuthActions />) : null}
        </div>
      ) : (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SignedInAccountRail />
        </div>
      )}
    </header>
  );
}
