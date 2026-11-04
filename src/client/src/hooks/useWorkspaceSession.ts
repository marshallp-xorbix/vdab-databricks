import { useQuery } from "@tanstack/react-query";
import { getWorkspaceSession } from "../api/workspaceSessionApi";

export const workspaceSessionKeys = {
  all: ["workspace-session"] as const,
};

/** Queries the authenticated identity and workspace for the setup page. */
export function useWorkspaceSession() {
  return useQuery({
    queryKey: workspaceSessionKeys.all,
    queryFn: ({ signal }) => getWorkspaceSession(signal),
    staleTime: 5 * 60 * 1000,
  });
}
