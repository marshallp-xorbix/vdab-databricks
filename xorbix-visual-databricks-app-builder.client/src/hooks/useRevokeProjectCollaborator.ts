import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeProjectCollaborator } from "../api/projectCollaboratorsApi";
import { projectCollaboratorKeys } from "./useProjectCollaborators";

/** Revokes an editor grant and refreshes the project collaborator list. */
export function useRevokeProjectCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeProjectCollaborator,
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({
        queryKey: projectCollaboratorKeys.detail(input.projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: ["projects", "list"],
      });
    },
  });
}
