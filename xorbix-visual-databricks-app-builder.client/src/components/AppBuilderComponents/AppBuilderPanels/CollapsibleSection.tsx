import { useState, type FC, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
  headerActions?: ReactNode;
  /** Optional content rendered immediately after the title (e.g. a Help link). */
  titleAccessory?: ReactNode;
  borderVariant?: "default" | "none";
  /** Builder sidebar chrome on image background: dark header text and borders. */
  panelTone?: "default" | "sidebarBlue";
  /**
   * When `panelTone` is sidebarBlue: `panel` matches Components/Add-modal title row
   * (large bold); `section` is category/subheaders (sm semibold).
   */
  sidebarTitleRole?: "panel" | "section";
  disableContentScroll?: boolean;
  collapsible?: boolean;
  /** When false, content is not its own scroll container (parent handles scroll). Avoids stacked scrollbar-gutter in Chrome. */
  scrollableContent?: boolean;
}

const CollapsibleSection: FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = true,
  isExpanded: controlledExpanded,
  onToggleExpanded,
  headerActions,
  titleAccessory,
  borderVariant = "default",
  panelTone = "default",
  sidebarTitleRole = "section",
  disableContentScroll = false,
  collapsible = true,
  scrollableContent = true,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    if (onToggleExpanded) {
      onToggleExpanded(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
    }
  };

  const borderClassMap = {
    default: "border-b border-[var(--builder-chrome-border)]",
    none: "",
  } as const;

  const borderClass = borderClassMap[borderVariant];

  const titleClass =
    panelTone === "sidebarBlue"
      ? sidebarTitleRole === "panel"
        ? "text-base font-bold tracking-tight text-[var(--builder-chrome-foreground)]"
        : "text-sm font-semibold text-[var(--builder-chrome-foreground)]"
      : "text-sm font-semibold text-foreground";

  const chevronClass =
    panelTone === "sidebarBlue"
      ? "h-4 w-4 text-[var(--builder-chrome-foreground-muted)]"
      : "h-4 w-4 text-muted-foreground";

  const collapsibleHeaderRowClass =
    panelTone === "sidebarBlue"
      ? "flex items-center justify-between px-3 py-2.5 transition-colors flex-shrink-0 hover:bg-[var(--builder-chrome-hover)]"
      : "flex items-center justify-between px-3 py-2.5 hover:bg-primary/10 transition-colors flex-shrink-0";

  const shellClass = [
    "flex flex-col",
    borderClass,
    scrollableContent ? "h-full min-h-0" : "min-h-0 min-w-0",
  ].join(" ");

  const contentDiv = scrollableContent ? (
    <div
      className={`builder-panel-scroll flex-1 min-h-0 ${
        disableContentScroll ? "overflow-hidden" : "overflow-y-auto"
      }`}
    >
      {children}
    </div>
  ) : (
    <div
      className={[
        "flex-shrink-0 min-w-0 overflow-x-hidden",
        disableContentScroll ? "overflow-y-hidden" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );

  if (!collapsible) {
    return (
      <div className={shellClass}>
        <div className="flex h-10 items-center justify-between gap-2 px-3 flex-shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className={titleClass}>{title}</span>
            {titleAccessory}
          </div>
          {headerActions && <div className="shrink-0">{headerActions}</div>}
        </div>
        {contentDiv}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className={collapsibleHeaderRowClass}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={handleToggle}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className={titleClass}>{title}</span>
            {isExpanded ? (
              <ChevronUp className={chevronClass} />
            ) : (
              <ChevronDown className={chevronClass} />
            )}
          </button>
          {titleAccessory}
        </div>
        {headerActions && (
          <div onClick={(e) => e.stopPropagation()}>{headerActions}</div>
        )}
      </div>
      {isExpanded && contentDiv}
    </div>
  );
};

export default CollapsibleSection;
