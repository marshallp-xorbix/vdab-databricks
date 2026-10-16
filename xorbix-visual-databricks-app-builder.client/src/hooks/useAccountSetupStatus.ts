import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { identityApi } from "../providers/IdentityApi";

const ACCOUNT_SETUP_STATUS_QUERY_KEY = "account-setup-status";
const ACCOUNT_SETUP_STATUS_REFRESH_MS = 10 * 60 * 1000;

/**
 * Query key for account setup status. Scoped by user and active tenant because
 * billing completeness is tenant-specific (JWT tenant context).
 */
export function getAccountSetupStatusQueryKey(
  userId?: string | null,
  tenantId?: string | null,
) {
  return [
    ACCOUNT_SETUP_STATUS_QUERY_KEY,
    userId ?? "anonymous",
    tenantId ?? "no-tenant",
  ] as const;
}

interface UseAccountSetupStatusOptions {
  userId?: string | null;
  tenantId?: string | null;
  enabled: boolean;
}

export function useAccountSetupStatus({
  userId,
  tenantId,
  enabled,
}: Readonly<UseAccountSetupStatusOptions>) {
  return useQuery({
    queryKey: getAccountSetupStatusQueryKey(userId, tenantId),
    queryFn: ({ signal }) => identityApi.getAccountSetupStatus(signal),
    enabled,
    refetchInterval: ACCOUNT_SETUP_STATUS_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

export function useInvalidateAccountSetupStatus() {
  const queryClient = useQueryClient();

  return useCallback(
    async (userId?: string | null, tenantId?: string | null) => {
      await queryClient.refetchQueries({
        queryKey:
          userId === undefined
            ? [ACCOUNT_SETUP_STATUS_QUERY_KEY]
            : getAccountSetupStatusQueryKey(userId, tenantId),
        exact: userId !== undefined,
      });
    },
    [queryClient],
  );
}
