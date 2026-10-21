import { Link, NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";

/** Navigation shell for the installed workspace-native product. */
function StandaloneAppLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        href="#page-content"
        className="sr-only z-50 rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:px-6">
        <Link
          to="/apps"
          className="shrink-0 rounded-sm text-base font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label="VDAB projects home"
        >
          Visual Databricks App Builder
        </Link>
        <nav
          aria-label="Primary navigation"
          className="order-3 flex w-full flex-wrap gap-2 text-sm md:order-2 md:w-auto"
        >
          <NavLink
            to="/apps"
            className={({ isActive }) => navigationClassName(isActive)}
          >
            Projects
          </NavLink>
          <NavLink
            to="/workspace/apps"
            className={({ isActive }) => navigationClassName(isActive)}
          >
            Workspace apps
          </NavLink>
          <NavLink
            to="/databricks"
            className={({ isActive }) => navigationClassName(isActive)}
          >
            Workspace setup
          </NavLink>
        </nav>
        <div className="order-2 ml-auto md:order-3">
          <ThemeToggle />
        </div>
      </header>
      <div id="page-content" tabIndex={-1}>
        <Outlet />
      </div>
    </div>
  );
}

function navigationClassName(isActive: boolean): string {
  const baseClassName =
    "rounded-md px-3 py-2 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  return isActive
    ? `${baseClassName} bg-accent font-medium text-accent-foreground`
    : `${baseClassName} text-muted-foreground`;
}

export default StandaloneAppLayout;
