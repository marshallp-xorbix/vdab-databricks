import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importProject } from "../api/projectsApi";
import { projectKeys } from "./useProjects";

/** Imports a standalone project and refreshes the caller's workspace project list. */
export function useImportProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
