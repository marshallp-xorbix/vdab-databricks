import { useQuery } from "@tanstack/react-query";
import { clientConfigApi } from "../providers/ClientConfigApi";

export const clientConfigKeys = {
  all: ["clientConfig"] as const,
};

const DEFAULT_MEMBERSHIP_REINSTATEMENT_DAYS = 90;

export interface ClientConfigState {
  /** True when the app is in passwordless-only mode. Defaults to false until the config has loaded. */
  passwordlessOnly: boolean;
  /**
   * Days an Ended membership can be restored. Defaults to 90 until the config has loaded.
   */
  membershipReinstatementDays: number;
  /** True once the runtime config has been fetched, so callers can avoid acting on the default. */
  isConfigLoaded: boolean;
}

/**
 * Reads the anonymous runtime client configuration. The query is cached app-wide under a single key, so
 * calling this hook from multiple components results in one network request. The config is constant for the
 * lifetime of a deployed build, so it never goes stale.
 */
export function useClientConfig(): ClientConfigState {
  const { data, isSuccess } = useQuery({
    queryKey: clientConfigKeys.all,
    queryFn: () => clientConfigApi.getClientConfig(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return {
    passwordlessOnly: data?.passwordlessOnly ?? false,
    membershipReinstatementDays:
      data?.membershipReinstatementDays ?? DEFAULT_MEMBERSHIP_REINSTATEMENT_DAYS,
    isConfigLoaded: isSuccess,
  };
}
