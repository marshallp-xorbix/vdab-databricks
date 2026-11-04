import { useCallback, useState } from "react";
import type { VdabComponent } from "../types/components";

interface ModalDeletionState {
  id: string;
  name: string;
  componentCount: number;
}

interface UseModalDeletionOptions {
  formComponents: VdabComponent[];
  getModalChildComponents: (
    components: VdabComponent[],
    modalId: string,
  ) => VdabComponent[];
}

export const useModalDeletion = ({
  formComponents,
  getModalChildComponents,
}: UseModalDeletionOptions) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modalToDelete, setModalToDelete] = useState<ModalDeletionState | null>(
    null,
  );

  const handleDeleteClick = useCallback(
    (modalId: string) => {
      const modal = formComponents.find((c) => c.id === modalId);
      if (!modal) return;

      const childComponents = getModalChildComponents(formComponents, modalId);
      const modalName = modal.props?.title || modal.codeName;

      setModalToDelete({
        id: modalId,
        name: modalName,
        componentCount: childComponents.length,
      });
      setDeleteDialogOpen(true);
    },
    [formComponents, getModalChildComponents],
  );

  const handleConfirmDelete = useCallback(() => {
    const modalId = modalToDelete?.id ?? null;
    setDeleteDialogOpen(false);
    setModalToDelete(null);
    return modalId;
  }, [modalToDelete]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setModalToDelete(null);
  }, []);

  return {
    deleteDialogOpen,
    modalToDelete,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
  };
};
