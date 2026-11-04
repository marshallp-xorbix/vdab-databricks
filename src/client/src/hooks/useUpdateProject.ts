import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProject } from "../api/projectsApi";
import { projectKeys } from "./useProjects";
import { projectComponentsKeys } from "./useProjectComponents";
import { projectWorkflowKeys } from "./useProjectWorkflow";

/** Saves project metadata and refreshes cached list and detail data. */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProject,
    onSuccess: async (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: projectComponentsKeys.detail(project.id),
        }),
        queryClient.invalidateQueries({
          queryKey: projectWorkflowKeys.detail(project.id),
        }),
      ]);
    },
    onError: async (_error, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(input.id) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: projectComponentsKeys.detail(input.id),
        }),
        queryClient.invalidateQueries({
          queryKey: projectWorkflowKeys.detail(input.id),
        }),
      ]);
    },
  });
}
