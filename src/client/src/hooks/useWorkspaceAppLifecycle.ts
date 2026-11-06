import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaceApp,
  startWorkspaceApp,
  stopWorkspaceApp,
} from "../api/workspaceAppsApi";

export const workspaceAppLifecycleKeys = {
  detail: (appName: string | undefined) =>
    ["workspace-apps", "detail", appName ?? ""] as const,
};

/** Reads and controls a linked child App through the acting user's workspace permissions. */
export function useWorkspaceAppLifecycle(appName: string | undefined) {
  const queryClient = useQueryClient();
  const appQuery = useQuery({
    queryKey: workspaceAppLifecycleKeys.detail(appName),
    queryFn: ({ signal }) => getWorkspaceApp(appName ?? "", signal),
    enabled: Boolean(appName),
    refetchInterval: (query) => {
      const state = `${query.state.data?.computeState ?? ""} ${query.state.data?.appState ?? ""}`.toUpperCase();
      return /STARTING|STOPPING|UPDATING|DEPLOYING/.test(state) ? 3_000 : 60_000;
    },
  });
  const actionMutation = useMutation({
    mutationFn: (action: "start" | "stop") =>
      action === "start"
        ? startWorkspaceApp(appName ?? "")
        : stopWorkspaceApp(appName ?? ""),
    onSuccess: (app) => {
      queryClient.setQueryData(workspaceAppLifecycleKeys.detail(appName), app);
    },
  });

  return { appQuery, actionMutation };
}
