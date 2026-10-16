import { NavLink, Link } from "react-router-dom";
import XorbixLogo from "../assets/xorbix-logo.png";
import { buttonVariants } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { ThemeToggle } from "./ThemeToggle";

const baseNavClass =
  "px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors";
const activeNavClass = `${baseNavClass} bg-white/20 text-white pointer-events-none`;
const inactiveNavClass = `${baseNavClass} text-white/70 hover:text-white hover:bg-white/10`;
const mobileNavClass =
  "block rounded-md px-3 py-2 text-base font-medium transition-colors";
const mobileActiveNavClass = `${mobileNavClass} bg-white/20 text-white pointer-events-none`;
const mobileInactiveNavClass = `${mobileNavClass} text-white/75 hover:bg-white/10 hover:text-white`;
const mobileUtilityLinkClass =
  "block rounded-md px-3 py-2 text-base font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white";

export default function PublicHeader() {
  return (
    <header className="top-0 z-50 border-b border-white/20 shell-header-chrome">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="relative flex h-16 items-center md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation menu"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon",
                  className: "text-white hover:bg-white/10 hover:text-white",
                })}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </svg>
              </button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-72 border-white/15 bg-[var(--shell-surface)] p-0 text-white [&>button]:text-white [&>button]:hover:bg-white/10"
            >
              <SheetHeader className="px-6 pb-2 pt-6">
                <SheetTitle className="text-white">Menu</SheetTitle>
                <SheetDescription className="text-white/70">
                  Navigate the public pages.
                </SheetDescription>
              </SheetHeader>

              <nav className="px-3 pb-3">
                <SheetClose asChild>
                  <NavLink to="/" end>
                    {({ isActive }) =>
                      isActive ? (
                        <span className={mobileActiveNavClass}>Overview</span>
                      ) : (
                        <span className={mobileInactiveNavClass}>Overview</span>
                      )
                    }
                  </NavLink>
                </SheetClose>
                <SheetClose asChild>
                  <NavLink to="/docs">
                    {({ isActive }) =>
                      isActive ? (
                        <span className={mobileActiveNavClass}>
                          Documentation
                        </span>
                      ) : (
                        <span className={mobileInactiveNavClass}>
                          Documentation
                        </span>
                      )
                    }
                  </NavLink>
                </SheetClose>
                <SheetClose asChild>
                  <NavLink to="/pricing">
                    {({ isActive }) =>
                      isActive ? (
                        <span className={mobileActiveNavClass}>Pricing</span>
                      ) : (
                        <span className={mobileInactiveNavClass}>Pricing</span>
                      )
                    }
                  </NavLink>
                </SheetClose>
                <SheetClose asChild>
                  <NavLink to="/docs/changelog">
                    {({ isActive }) =>
                      isActive ? (
                        <span className={mobileActiveNavClass}>Changelog</span>
                      ) : (
                        <span className={mobileInactiveNavClass}>
                          Changelog
                        </span>
                      )
                    }
                  </NavLink>
                </SheetClose>
              </nav>

              <div className="border-t border-white/20 px-3 py-3">
                <SheetClose asChild>
                  <Link to="/passwordless" className={mobileUtilityLinkClass}>
                    Dev Login
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/login" className={mobileUtilityLinkClass}>
                    Login
                  </Link>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <img
              src={XorbixLogo}
              alt="Xorbix logo"
              className="h-7 shrink-0 object-contain brightness-0 invert"
            />
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
            <Link
              to="/login"
              className={buttonVariants({
                className:
                  "bg-white! text-primary! text-sm font-semibold shadow-md hover:bg-white/90!",
              })}
            >
              Login
            </Link>
          </div>
        </div>

        <div className="hidden h-16 items-center justify-between gap-6 md:flex">
          <Link to="/">
            <img
              src={XorbixLogo}
              alt="Xorbix logo"
              className="h-8 shrink-0 object-contain brightness-0 invert"
            />
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/" end>
              {({ isActive }) =>
                isActive ? (
                  <span className={activeNavClass}>Overview</span>
                ) : (
                  <span className={inactiveNavClass}>Overview</span>
                )
              }
            </NavLink>
            <NavLink to="/status">
              {({ isActive }) =>
                isActive ? (
                  <span className={activeNavClass}>Status</span>
                ) : (
                  <span className={inactiveNavClass}>Status</span>
                )
              }
            </NavLink>
            <NavLink to="/docs">
              {({ isActive }) =>
                isActive ? (
                  <span className={activeNavClass}>Documentation</span>
                ) : (
                  <span className={inactiveNavClass}>Documentation</span>
                )
              }
            </NavLink>
            <NavLink to="/pricing">
              {({ isActive }) =>
                isActive ? (
                  <span className={activeNavClass}>Pricing</span>
                ) : (
                  <span className={inactiveNavClass}>Pricing</span>
                )
              }
            </NavLink>
            <NavLink to="/docs/changelog">
              {({ isActive }) =>
                isActive ? (
                  <span className={activeNavClass}>Changelog</span>
                ) : (
                  <span className={inactiveNavClass}>Changelog</span>
                )
              }
            </NavLink>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
            <Link
              to="/passwordless"
              className={buttonVariants({
                variant: "outline",
                className:
                  "border-white/40 bg-transparent text-sm text-white! hover:bg-white/10",
              })}
            >
              Dev Login
            </Link>
            <Link
              to="/login"
              className={buttonVariants({
                className:
                  "bg-white! text-primary! text-sm font-semibold shadow-md hover:bg-white/90!",
              })}
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
