import { useMutation } from "@tanstack/react-query";
import { exportProject } from "../api/projectsApi";

/** Exports the requested project as a standalone v1 document. */
export function useExportProject() {
  return useMutation({ mutationFn: exportProject });
}
