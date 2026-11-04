import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { navigationClassName } from "./navigationClassName";

interface IBuilderNavigationLinkProps {
  appId: string;
  section: string;
  label: string;
  icon: ReactNode;
  isCollapsed?: boolean;
  isSelected: boolean;
  isMobile?: boolean;
}

/** Links to a builder section while keeping its active state in the URL. */
function BuilderNavigationLink({
  appId,
  section,
  label,
  icon,
  isCollapsed = false,
  isSelected,
  isMobile = false,
}: Readonly<IBuilderNavigationLinkProps>) {
  const to = section === "components" ? `/apps/${appId}` : `/apps/${appId}?section=${section}`;
  return (
    <Link
      to={to}
      title={isCollapsed ? label : undefined}
      aria-label={label}
      aria-current={isSelected ? "page" : undefined}
      className={isMobile ? mobileNavigationClassName(isSelected) : navigationClassName(isSelected, isCollapsed)}
    >
      {icon}
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );
}

function mobileNavigationClassName(isActive: boolean): string {
  return `shrink-0 rounded-md px-3 py-2 text-sm ${isActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"}`;
}

export default BuilderNavigationLink;
