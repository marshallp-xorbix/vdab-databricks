/** Returns the shared active and collapsed sidebar link classes. */
export function navigationClassName(
  isActive: boolean,
  isCollapsed: boolean,
): string {
  return `flex min-h-9 items-center gap-3 rounded-md border-l-[3px] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isCollapsed ? "justify-center px-1" : ""} ${isActive ? "border-primary bg-accent font-medium text-accent-foreground" : "border-transparent text-foreground hover:bg-accent/60"}`;
}
