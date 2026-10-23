import { useEffect, useRef } from "react";
import type { IProjectComponent } from "../models/ProjectComponents";

/** Delay before persisting an idle component draft. */
export const PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS = 1_200;

interface UseProjectComponentsAutosaveOptions {
  draft: readonly IProjectComponent[];
  isDirty: boolean;
  canSave: boolean;
  isSaving: boolean;
  hasError: boolean;
  onSave: () => Promise<void>;
}

/** Saves a component draft after editing pauses, without retrying failures automatically. */
export function useProjectComponentsAutosave({
  draft,
  isDirty,
  canSave,
  isSaving,
  hasError,
  onSave,
}: Readonly<UseProjectComponentsAutosaveOptions>): void {
  const saveRef = useRef(onSave);

  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!isDirty || !canSave || isSaving || hasError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveRef.current();
    }, PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [draft, isDirty, canSave, isSaving, hasError]);
}
