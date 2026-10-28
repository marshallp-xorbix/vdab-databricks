import { Code2, LayoutGrid, Settings2, Workflow } from "lucide-react";
import { NavLink } from "react-router-dom";
import BuilderNavigationLink from "./BuilderNavigationLink";

const BUILDER_SECTIONS = [
  { key: "components", label: "Canvas", icon: LayoutGrid },
  { key: "workflows", label: "Main Flow", icon: Workflow },
  { key: "code", label: "Code", icon: Code2 },
  { key: "settings", label: "Settings", icon: Settings2 },
] as const;

interface IStandaloneMobileNavigationProps {
  appId: string | undefined;
  activeBuilderSection: string;
}

/** Shows compact route navigation on narrow screens. */
function StandaloneMobileNavigation({
  appId,
  activeBuilderSection,
}: Readonly<IStandaloneMobileNavigationProps>) {
  if (appId) {
    return (
      <nav
        aria-label="Builder navigation"
        className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden"
      >
        {BUILDER_SECTIONS.map((section) => (
          <BuilderNavigationLink
            key={section.key}
            appId={appId}
            section={section.key}
            label={section.label}
            icon={null}
            isSelected={activeBuilderSection === section.key}
            isMobile
          />
        ))}
        <NavLink to="/apps" className={() => mobileNavigationClassName(false)}>
          Back to Apps
        </NavLink>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Workspace navigation"
      className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden"
    >
      <NavLink to="/apps" className={({ isActive }) => mobileNavigationClassName(isActive)}>
        Apps
      </NavLink>
      <NavLink to="/workspace/apps" className={({ isActive }) => mobileNavigationClassName(isActive)}>
        Workspace apps
      </NavLink>
      <NavLink to="/databricks" className={({ isActive }) => mobileNavigationClassName(isActive)}>
        Workspace setup
      </NavLink>
    </nav>
  );
}

function mobileNavigationClassName(isActive: boolean): string {
  return `shrink-0 rounded-md px-3 py-2 text-sm ${isActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"}`;
}

export default StandaloneMobileNavigation;
