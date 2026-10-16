import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "../api/TenantApi";
import { identityApi } from "../providers/IdentityApi";
import { useIdentity } from "./IdentityContext";
import { TenantMembership, type ITenantMembership } from "../models";

type TenantContextValue = {
  tenants: ITenantMembership[];
  currentTenant: ITenantMembership | null;
  isLoading: boolean;
  isSwitching: boolean;
  switchingTenantId: string | null;
  isSettingDefault: boolean;
  settingDefaultTenantId: string | null;
  refreshTenants: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  setDefaultTenant: (tenantId: string) => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

type JwtClaims = {
  tenant_id?: string;
};

type TenantProviderProps = {
  children: ReactNode;
};

const decodeJwtClaims = (token: string | null): JwtClaims | null => {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");

    const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
};

const getTenantIdFromToken = (token: string | null): string | null => {
  const claims = decodeJwtClaims(token);
  if (!claims?.tenant_id) return null;

  return claims.tenant_id;
};

export function TenantProvider({ children }: TenantProviderProps) {
  const { user, isLoading: isIdentityLoading, refreshCurrentUser } =
    useIdentity();
  const queryClient = useQueryClient();

  const [tenants, setTenants] = useState<ITenantMembership[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(
    null,
  );
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [settingDefaultTenantId, setSettingDefaultTenantId] = useState<
    string | null
  >(null);

  const refreshTenants = useCallback(async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenantId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const memberships = (await tenantApi.getMyTenants()).map(
        (membership) => new TenantMembership(membership),
      );

      const tokenTenantId = getTenantIdFromToken(identityApi.getToken());
      const resolvedTenantId =
        tokenTenantId ??
        memberships.find((membership) => membership.isCurrentTenant)
          ?.tenantId ??
        null;

      setCurrentTenantId(resolvedTenantId);
      setTenants(
        memberships.map((membership) => ({
          ...membership,
          isCurrentTenant:
            resolvedTenantId === null
              ? membership.isCurrentTenant
              : membership.tenantId === resolvedTenantId,
        })),
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isIdentityLoading) return;
    void refreshTenants();
  }, [isIdentityLoading, refreshTenants]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      setIsSwitching(true);
      setSwitchingTenantId(tenantId);

      try {
        const authResponse = await tenantApi.switchTenant(tenantId);
        identityApi.applyAuthResponse(authResponse);

        // Profile claims (tenantId / tenantRole) must match the new JWT before pages refetch.
        await refreshCurrentUser();

        // Invalidate tenant-scoped caches so active queries refetch for the new tenant.
        // Do not clear(): wiping cached setup-complete status forces a cold Stripe
        // re-check that can falsely send paid/trialing tenants back to billing setup.
        await queryClient.invalidateQueries();

        const tokenTenantId =
          getTenantIdFromToken(authResponse.accessToken) ?? tenantId;

        setCurrentTenantId(tokenTenantId);
        setTenants((previous) =>
          previous.map((membership) => ({
            ...membership,
            isCurrentTenant: membership.tenantId === tokenTenantId,
          })),
        );
      } finally {
        setIsSwitching(false);
        setSwitchingTenantId(null);
      }
    },
    [queryClient, refreshCurrentUser],
  );

  const setDefaultTenant = useCallback(async (tenantId: string) => {
    setIsSettingDefault(true);
    setSettingDefaultTenantId(tenantId);

    try {
      await tenantApi.setDefaultTenant(tenantId);
      setTenants((previous) =>
        previous.map((membership) => ({
          ...membership,
          isDefault: membership.tenantId === tenantId,
        })),
      );
    } finally {
      setIsSettingDefault(false);
      setSettingDefaultTenantId(null);
    }
  }, []);

  const currentTenant = useMemo(
    () =>
      tenants.find((membership) => membership.tenantId === currentTenantId) ??
      tenants.find((membership) => membership.isCurrentTenant) ??
      null,
    [tenants, currentTenantId],
  );

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      currentTenant,
      isLoading,
      isSwitching,
      switchingTenantId,
      isSettingDefault,
      settingDefaultTenantId,
      refreshTenants,
      switchTenant,
      setDefaultTenant,
    }),
    [
      tenants,
      currentTenant,
      isLoading,
      isSwitching,
      switchingTenantId,
      isSettingDefault,
      settingDefaultTenantId,
      refreshTenants,
      switchTenant,
      setDefaultTenant,
    ],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenantContext(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenantContext must be used within a TenantProvider");
  }

  return context;
}
