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
}

/**
 * Full-width shell header with VDAB logo. Guest: public auth flows + theme toggle.
 * Apps/Admin/Builder: signed-in shell (mobile sidebar trigger + account rail).
 */
export function BrandedTopBar({
  variant,
  builderAppTitle = "",
}: Readonly<BrandedTopBarProps>) {
  const logoLink = variant === "guest" || variant === "setup" ? "/" : "/apps";

  return (
    <header
      className={cn(
        "chrome-inside-blue-glow chrome-inside-blue-glow--no-sides shell-header-chrome flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-white/20 px-4 text-white md:gap-3 md:px-5",
      )}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        {variant === "apps" || variant === "admin" || variant === "builder" ? (
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

      {variant === "guest" || variant === "setup" ? (
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
          {variant === "setup" ? <SetupAuthActions /> : <GuestAuthActions />}
        </div>
      ) : (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SignedInAccountRail />
        </div>
      )}
    </header>
  );
}
