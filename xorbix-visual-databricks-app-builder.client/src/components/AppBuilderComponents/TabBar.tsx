/**
 * VS Code-style tab bar for the AppBuilder editor
 */

import type { FC } from "react";
import { X } from "lucide-react";
import type { EditorTab } from "../../types/editor";

interface TabBarProps {
  tabs: EditorTab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

const TabBar: FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
}) => {
  return (
    <div className="builder-chrome-surface builder-chrome-toolbar-row flex min-w-0 items-end gap-1 px-2">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        return (
          <div key={tab.id} className="group relative flex h-9 min-w-[120px] max-w-[200px] flex-none items-center">
            <button
              type="button"
              aria-pressed={isActive}
              className={`
            flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-t-md border border-[var(--builder-tab-border)] px-2 text-sm transition-colors sm:px-3
            ${
              isActive
                ? "relative z-[1] -mb-px border-b-0 border-[var(--builder-tab-border-active)] bg-card font-semibold text-foreground shadow-[0_-1px_6px_rgba(0,0,0,0.08)]"
                : "border-b-0 bg-card/30 font-normal text-[var(--builder-chrome-foreground)] hover:bg-card/45"
            }
          `}
            onClick={() => onTabClick(tab.id)}
          >
            <span className="flex-1 truncate">{tab.label}</span>
            </button>
            {tab.canClose && (
              <button
                type="button"
                onClick={(e) => {
                  onTabClose(tab.id);
                }}
                className="absolute right-2 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                aria-label={`Close ${tab.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabBar;
