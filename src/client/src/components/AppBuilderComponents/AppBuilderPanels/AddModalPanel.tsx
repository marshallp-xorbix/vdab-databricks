/**
 * Panel for adding new modals from the Main Flow view
 */

import type { FC } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../ui/button";
import {
  ComponentType,
  ComponentCategory,
} from "../../../types/components/componentTypes";
import type { VdabComponent } from "../../../types/components";
import { useLogger } from "../../../logger/useLogger";

interface AddModalPanelProps {
  onAddModal: (modal: VdabComponent) => void;
}

const AddModalPanel: FC<AddModalPanelProps> = ({ onAddModal }) => {
  const logger = useLogger("AddModalPanel");
  const handleAddModal = () => {
    const newModal: VdabComponent = {
      id: crypto.randomUUID(),
      codeName: "",
      type: ComponentType.Modal,
      category: ComponentCategory.Page,
      props: {
        title: "New Modal",
      },
      children: [],
      bindings: {},
      schemaVersion: 1,
    };
    logger.UI.log("Creating new modal with id ", newModal.id);
    onAddModal(newModal);
  };

  return (
    <div className="p-4">
      <div className="space-y-3">
        <Button
          onClick={handleAddModal}
          className="flex w-full items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Modal
        </Button>

        <div className="text-xs text-muted-foreground mt-4">
          After creating a modal, configure a workflow to show the modal.
        </div>
        <div title="Coming Soon">
          <Button
            disabled
            aria-label="Add Page coming soon"
            className="flex w-full cursor-not-allowed items-center gap-2 bg-primary text-primary-foreground opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add Page
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddModalPanel;
