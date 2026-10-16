import { useCallback, useState } from "react";
import type { VdabComponent } from "../types/components";
import type { EditorTab } from "../types/editor";
import { TabType } from "../types/editor";

interface UseTabManagementOptions {
  findComponent: (id: string) => VdabComponent | undefined;
  onTabClosed?: () => void;
}

type OpenableTabType = typeof TabType.MainPage | typeof TabType.Modal;

export const useTabManagement = ({
  findComponent,
  onTabClosed,
}: UseTabManagementOptions) => {
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([
    {
      id: "main-flow",
      type: TabType.MainFlow,
      label: "App Flow",
      canClose: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("main-flow");

  const openTab = useCallback(
    (type: OpenableTabType, modalId?: string, label?: string) => {
      const tabId =
        type === TabType.MainPage ? "main-page" : `modal-${modalId}`;

      setOpenTabs((prev) => {
        const existingTab = prev.find((tab) => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return prev;
        }

        let tabLabel: string;
        if (type === TabType.Modal && modalId) {
          const modal = findComponent(modalId);
          tabLabel = modal?.props?.title || modal?.codeName;
        } else {
          tabLabel = label || "Main Page";
        }

        const newTab: EditorTab = {
          id: tabId,
          type,
          label: tabLabel,
          modalId: type === TabType.Modal ? modalId : undefined,
          canClose: true,
        };

        setActiveTabId(tabId);
        return [...prev, newTab];
      });
    },
    [findComponent],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      if (tabId === "main-flow") return;

      setOpenTabs((prev) => {
        const filtered = prev.filter((tab) => tab.id !== tabId);

        if (activeTabId === tabId) {
          const newActiveTab = filtered[filtered.length - 1] || filtered[0];
          setActiveTabId(newActiveTab.id);
        }

        return filtered;
      });

      onTabClosed?.();
    },
    [activeTabId, onTabClosed],
  );

  const syncModalTabLabels = useCallback(() => {
    setOpenTabs((prev) =>
      prev.map((tab) => {
        if (tab.type === TabType.Modal && tab.modalId) {
          const modal = findComponent(tab.modalId);
          if (modal) {
            return {
              ...tab,
              label: modal.props?.title || modal.codeName,
            };
          }
        }
        return tab;
      }),
    );
  }, [findComponent]);

  const replaceTabs = useCallback((tabs: EditorTab[]) => {
    setOpenTabs(tabs);
  }, []);

  return {
    openTabs,
    activeTabId,
    setActiveTabId,
    openTab,
    closeTab,
    syncModalTabLabels,
    replaceTabs,
  };
};
