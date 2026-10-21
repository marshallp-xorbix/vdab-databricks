import { useMutation, useQueryClient } from "@tanstack/react-query";
import { replaceProjectCustomModules } from "../api/projectCustomModulesApi";
import { projectComponentsKeys } from "./useProjectComponents";
import { projectCustomModulesKeys } from "./useProjectCustomModules";
import { projectKeys } from "./useProjects";
import { projectWorkflowKeys } from "./useProjectWorkflow";

/** Saves custom Python source and refreshes aggregates sharing the project version. */
export function useReplaceProjectCustomModules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replaceProjectCustomModules,
    onSuccess: async (document) => {
      queryClient.setQueryData(projectCustomModulesKeys.detail(document.projectId), document);
      await invalidateProjectAggregates(queryClient, document.projectId);
    },
    onError: async (_error, input) => {
      await invalidateProjectAggregates(queryClient, input.projectId);
      await queryClient.invalidateQueries({ queryKey: projectCustomModulesKeys.detail(input.projectId) });
    },
  });
}

async function invalidateProjectAggregates(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
    queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: projectComponentsKeys.detail(projectId) }),
    queryClient.invalidateQueries({ queryKey: projectWorkflowKeys.detail(projectId) }),
  ]);
}
