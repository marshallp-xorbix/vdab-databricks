import { useInfiniteQuery } from "@tanstack/react-query";
import { listWorkspaceApps } from "../api/workspaceAppsApi";

export const workspaceAppKeys = {
  all: ["workspace-apps"] as const,
  lists: () => [...workspaceAppKeys.all, "list"] as const,
};

/** Queries the workspace app list and follows its continuation tokens. */
export function useWorkspaceApps(enabled = true) {
  return useInfiniteQuery({
    queryKey: workspaceAppKeys.lists(),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listWorkspaceApps(pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    enabled,
  });
}
