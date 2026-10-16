import type { FC } from "react";
import type { BuilderMode } from "../../../context/BuilderLayoutContext";
import { TabType } from "../../../types/editor";
import type { VdabComponent } from "../../../types/components";
import ComponentPanel from "./ComponentPanel";
import AddModalPanel from "./AddModalPanel";

interface BuilderLeftPanelProps {
  builderMode: BuilderMode;
  activeTabType: TabType | undefined;
  onAddModal: (modal: VdabComponent) => void;
  isDragActive: boolean;
}

const BuilderLeftPanel: FC<BuilderLeftPanelProps> = ({
  builderMode,
  activeTabType,
  onAddModal,
  isDragActive,
}) => {
  if (builderMode === "canvas") {
    const isAppFlow = !activeTabType || activeTabType === TabType.MainFlow;

    if (isAppFlow) {
      return (
        <div className="builder-sidebar-surface builder-chrome-surface flex h-full flex-col overflow-hidden border-r border-[var(--builder-chrome-border)]">
          <div className="flex h-10 flex-shrink-0 items-center border-b border-[var(--builder-chrome-border)] px-3">
            <span className="text-base font-bold tracking-tight text-[var(--builder-chrome-foreground)]">
              Add Page/Modal
            </span>
          </div>
          <div className="flex-shrink-0 border-b border-[var(--builder-chrome-border)] bg-[var(--builder-chrome-hint-bg)] px-3 py-1 text-xs italic text-[var(--builder-chrome-foreground)]">
            Double click on a node to open its canvas/workflow
          </div>
          <div className="builder-panel-scroll flex-1 overflow-y-auto p-2">
            <div className="rounded-lg border border-[var(--builder-chrome-border)] bg-[var(--builder-panel-bg)] p-2 text-[var(--builder-panel-foreground)] shadow-sm">
              <AddModalPanel onAddModal={onAddModal} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="builder-sidebar-surface builder-chrome-surface flex h-full flex-col overflow-hidden border-r border-[var(--builder-chrome-border)]">
        <ComponentPanel disableScroll={isDragActive} />
      </div>
    );
  }

  // code, workflow, and settings modes have no left panel content
  return null;
};

export default BuilderLeftPanel;
