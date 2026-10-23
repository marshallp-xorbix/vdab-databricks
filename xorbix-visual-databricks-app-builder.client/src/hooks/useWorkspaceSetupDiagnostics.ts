import { useQuery } from "@tanstack/react-query";
import { getWorkspaceSetupDiagnostics } from "../api/workspaceSetupDiagnosticsApi";

export const workspaceSetupDiagnosticsKeys = {
  all: ["workspace-setup-diagnostics"] as const,
  user: (userId: string | null) =>
    [...workspaceSetupDiagnosticsKeys.all, userId] as const,
};

/** Keeps the user-triggered workspace diagnostic result in TanStack Query. */
export function useWorkspaceSetupDiagnostics(userId: string | null) {
  return useQuery({
    queryKey: workspaceSetupDiagnosticsKeys.user(userId),
    queryFn: ({ signal }) => getWorkspaceSetupDiagnostics(signal),
    enabled: false,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}
