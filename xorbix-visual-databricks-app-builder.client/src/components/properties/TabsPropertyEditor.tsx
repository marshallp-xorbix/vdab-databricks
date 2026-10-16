import { type FC, useEffect, useMemo, useState } from "react";
import type { VdabComponent } from "../../types/components";
import { getLayoutTabIndex } from "../../utils/layoutUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { EditableStringListPropertyEditor } from "./EditableStringListPropertyEditor";

interface TabsPropertyEditorProps {
  component: VdabComponent;
  allComponents: VdabComponent[];
  onPropertyChange: (key: string, value: unknown) => void;
  onDeleteTab?: (componentId: string, tabIndex: number) => void;
}

export const TabsPropertyEditor: FC<TabsPropertyEditorProps> = ({
  component,
  allComponents,
  onPropertyChange,
  onDeleteTab,
}) => {
  const persistedTabs = useMemo<string[]>(() => {
    const tabsValue = component.props?.tabs;
    if (!Array.isArray(tabsValue) || tabsValue.length === 0) {
      return ["Tab 1"];
    }

    return tabsValue.map((tab) => String(tab));
  }, [component.props?.tabs]);

  const [tabDrafts, setTabDrafts] = useState<string[]>(persistedTabs);
  const [tabErrors, setTabErrors] = useState<Record<number, string>>({});
  const [pendingDeleteTabIndex, setPendingDeleteTabIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    setTabDrafts(persistedTabs);
    setTabErrors({});
  }, [component.id, persistedTabs]);

  const childComponentById = useMemo(() => {
    return new Map(
      allComponents.map((childComponent) => [
        childComponent.id,
        childComponent,
      ]),
    );
  }, [allComponents]);

  const childCountByTabIndex = useMemo(() => {
    const counts = new Map<number, number>();
    const childIds = component.children || [];

    childIds.forEach((childId) => {
      const childComponent = childComponentById.get(childId);
      if (!childComponent) {
        return;
      }

      const tabIdx = getLayoutTabIndex(childComponent.layout) ?? 0;
      counts.set(tabIdx, (counts.get(tabIdx) ?? 0) + 1);
    });

    return counts;
  }, [childComponentById, component.children]);

  const childCountForPendingDelete = useMemo(() => {
    if (pendingDeleteTabIndex === null) {
      return 0;
    }

    return childCountByTabIndex.get(pendingDeleteTabIndex) ?? 0;
  }, [childCountByTabIndex, pendingDeleteTabIndex]);

  const handleAddTab = () => {
    setTabDrafts((previous) => {
      const nextTabs = [...previous, `Tab ${previous.length + 1}`];
      onPropertyChange("tabs", nextTabs);
      return nextTabs;
    });
  };

  const handleRenameTab = (index: number, value: string) => {
    const nextTabs = tabDrafts.map((tabName, currentIndex) =>
      currentIndex === index ? value : tabName,
    );
    setTabDrafts(nextTabs);

    const trimmed = value.trim();
    if (!trimmed) {
      setTabErrors((previous) => ({
        ...previous,
        [index]: "Tab name is required.",
      }));
      return;
    }

    setTabErrors((previous) => {
      const nextErrors = { ...previous };
      delete nextErrors[index];
      return nextErrors;
    });

    onPropertyChange("tabs", nextTabs);
  };

  const deleteTab = (index: number) => {
    if (onDeleteTab) {
      onDeleteTab(component.id, index);
      return;
    }

    if ((childCountByTabIndex.get(index) ?? 0) > 0) {
      return;
    }

    const nextTabs = tabDrafts.filter(
      (_, currentIndex) => currentIndex !== index,
    );
    setTabDrafts(nextTabs);
    onPropertyChange("tabs", nextTabs);
  };

  const openDeleteDialog = (index: number) => {
    if (tabDrafts.length <= 1) {
      return;
    }

    const childCount = childCountByTabIndex.get(index) ?? 0;
    if (childCount === 0) {
      deleteTab(index);
      return;
    }

    if (!onDeleteTab) {
      return;
    }

    setPendingDeleteTabIndex(index);
  };

  const closeDeleteDialog = () => {
    setPendingDeleteTabIndex(null);
  };

  const confirmDeleteTab = () => {
    if (pendingDeleteTabIndex === null) {
      return;
    }

    deleteTab(pendingDeleteTabIndex);

    closeDeleteDialog();
  };

  return (
    <div className="space-y-3">
      <EditableStringListPropertyEditor
        label="Tabs"
        items={tabDrafts}
        onAdd={handleAddTab}
        onRemove={openDeleteDialog}
        onItemChange={handleRenameTab}
        addButtonLabel="+ Add Tab"
        getPlaceholder={(index) => `Tab ${index + 1}`}
        getAriaLabel={(index) => `Tab ${index + 1} name`}
        errors={tabErrors}
        showRemoveButton={(_, totalItems) => totalItems > 1}
      />

      <Dialog
        open={pendingDeleteTabIndex !== null}
        onOpenChange={closeDeleteDialog}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Tab</DialogTitle>
            <DialogDescription>
              Deleting this tab will also delete all components inside it.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-foreground">
              This will delete {childCountForPendingDelete} component
              {childCountForPendingDelete !== 1 ? "s" : ""} in this tab.
            </p>
            <p className="mt-3 text-sm font-medium text-destructive">
              This action cannot be undone.
            </p>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeDeleteDialog}>
              Cancel
            </Button>
            <Button onClick={confirmDeleteTab} variant="destructive">
              Delete Tab and Children
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TabsPropertyEditor;
