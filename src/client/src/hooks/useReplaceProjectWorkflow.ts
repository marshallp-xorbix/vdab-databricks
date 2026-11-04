import { useMutation, useQueryClient } from "@tanstack/react-query";
import { replaceProjectWorkflow } from "../api/projectWorkflowApi";
import { projectComponentsKeys } from "./useProjectComponents";
import { projectCustomModulesKeys } from "./useProjectCustomModules";
import { projectKeys } from "./useProjects";
import { projectWorkflowKeys } from "./useProjectWorkflow";

/** Saves workflow state and refreshes all caches sharing the project version. */
export function useReplaceProjectWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceProjectWorkflow,
    onSuccess: async (document) => {
      queryClient.setQueryData(
        projectWorkflowKeys.detail(document.projectId),
        document,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(document.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: projectComponentsKeys.detail(document.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectCustomModulesKeys.detail(document.projectId),
        }),
      ]);
    },
    onError: async (_error, input) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectWorkflowKeys.detail(input.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(input.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectComponentsKeys.detail(input.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: projectCustomModulesKeys.detail(input.projectId),
        }),
      ]);
    },
  });
}
