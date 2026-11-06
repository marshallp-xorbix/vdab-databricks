/** Returns the shared active and collapsed sidebar link classes. */
export function navigationClassName(
  isActive: boolean,
  isCollapsed: boolean,
  tone: "default" | "primary" = "default",
): string {
  const layout = `flex min-h-9 items-center gap-3 rounded-md px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isCollapsed ? "justify-center px-1" : ""}`;
  if (tone === "primary") {
    return `${layout} focus-visible:outline-white ${isActive ? "bg-[var(--primary-sidebar-active)] font-medium text-white" : "text-[var(--primary-sidebar-foreground)] hover:bg-[var(--primary-sidebar-hover)] hover:text-white"}`;
  }
  return `${layout} border-l-[3px] focus-visible:outline-primary ${isActive ? "border-primary bg-accent font-medium text-accent-foreground" : "border-transparent text-foreground hover:bg-accent/60"}`;
}
