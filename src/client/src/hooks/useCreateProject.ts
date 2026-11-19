import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "../api/projectsApi";
import type { IProjectList } from "../models/Project";
import { projectKeys } from "./useProjects";

/** Creates a project and refreshes the user's project list. */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: async (createdProject) => {
      queryClient.setQueryData<IProjectList>(projectKeys.lists(), (current) => {
        if (!current) return { items: [createdProject] };
        if (current.items.some((project) => project.id === createdProject.id)) {
          return current;
        }
        return { items: [createdProject, ...current.items] };
      });
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
