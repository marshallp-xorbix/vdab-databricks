import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useId,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../lib/utils";

export type TabbedContentItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  badgeLabel?: string;
};

export type TabContentProps = {
  id: string;
  children: ReactNode;
};

interface TabbedContentViewerProps {
  tabs: TabbedContentItem[];
  defaultTabId?: string;
  activeTabId?: string;
  id?: string;
  className?: string;
  onTabChange?: (tabId: string) => void;
  children: ReactNode;
}

export function TabContent(props: Readonly<TabContentProps>) {
  return <>{props.children}</>;
}

export function TabbedContentViewer({
  tabs,
  defaultTabId,
  activeTabId,
  id,
  className,
  onTabChange,
  children,
}: Readonly<TabbedContentViewerProps>) {
  const generatedId = useId().replace(/:/g, "");
  const containerId = id ?? `tabbed-content-${generatedId}`;

  const firstEnabledTabId = useMemo(
    () => tabs.find((tab) => !tab.disabled)?.id,
    [tabs],
  );

  const [internalActiveTabId, setInternalActiveTabId] = useState(
    defaultTabId ?? firstEnabledTabId ?? "",
  );

  useEffect(() => {
    if (activeTabId) {
      return;
    }

    const hasValidInternalTab = tabs.some(
      (tab) => tab.id === internalActiveTabId && !tab.disabled,
    );

    if (!hasValidInternalTab) {
      setInternalActiveTabId(defaultTabId ?? firstEnabledTabId ?? "");
    }
  }, [activeTabId, defaultTabId, firstEnabledTabId, internalActiveTabId, tabs]);

  const selectedTabId = activeTabId ?? internalActiveTabId;
  const activeTab =
    tabs.find((tab) => tab.id === selectedTabId && !tab.disabled) ??
    tabs.find((tab) => tab.id === defaultTabId && !tab.disabled) ??
    tabs.find((tab) => !tab.disabled);

  const tabPanels = useMemo(
    () =>
      Children.toArray(children).filter(
        (child): child is ReactElement<TabContentProps> =>
          isValidElement<TabContentProps>(child) && child.type === TabContent,
      ),
    [children],
  );

  const activePanel =
    tabPanels.find((panel) => panel.props.id === activeTab?.id) ??
    tabPanels.find((panel) => panel.props.id === defaultTabId) ??
    tabPanels[0];

  const handleTabClick = (tabId: string, disabled: boolean) => {
    if (disabled) {
      return;
    }

    if (!activeTabId) {
      setInternalActiveTabId(tabId);
    }

    onTabChange?.(tabId);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div
        id={containerId}
        className="overflow-x-auto overflow-y-hidden border-b border-border"
      >
        <nav className="-mb-px flex min-w-max space-x-8">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab?.id;
            const isDisabled = tab.disabled ?? false;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                disabled={isDisabled}
                onClick={() => handleTabClick(tab.id, isDisabled)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
                  isDisabled
                    ? "cursor-not-allowed"
                    : "cursor-pointer hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
                {tab.badgeLabel && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {tab.badgeLabel}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {activePanel ? (
        <div>{activePanel.props.children}</div>
      ) : (
        <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          No tab content is available.
        </div>
      )}
    </div>
  );
}
