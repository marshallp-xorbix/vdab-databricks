import { useMutation, useQueryClient } from "@tanstack/react-query";
import { replaceProjectComponents } from "../api/projectComponentsApi";
import { projectKeys } from "./useProjects";
import { projectComponentsKeys } from "./useProjectComponents";
import { projectCustomModulesKeys } from "./useProjectCustomModules";
import { projectWorkflowKeys } from "./useProjectWorkflow";

/** Saves the component aggregate and refreshes both project version caches. */
export function useReplaceProjectComponents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceProjectComponents,
    onSuccess: async (document) => {
      queryClient.setQueryData(
        projectComponentsKeys.detail(document.projectId),
        document,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(document.projectId),
        }),
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: projectWorkflowKeys.detail(document.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectCustomModulesKeys.detail(document.projectId),
        }),
      ]);
    },
    onError: async (_error, input) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectComponentsKeys.detail(input.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(input.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectWorkflowKeys.detail(input.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectCustomModulesKeys.detail(input.projectId),
        }),
      ]);
    },
  });
}
