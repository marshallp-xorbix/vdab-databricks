import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnFilterType } from "../components/ui/data-table";
import { ManagementPageHeader } from "../components/ManagementPageHeader";
import { Chip } from "../components/ui/chip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { toast } from "../components/ui/use-toast";
import { tenantApi, type IUpdateTenantRequest } from "../api/TenantApi";
import { userApi } from "../providers/UserApi";
import { useIdentity } from "../context/IdentityContext";
import { isGlobalAdministrator } from "../utils/roles";
import { useTeamSeats, type UseTeamSeatsOptions } from "../hooks/useTeamSeats";
import { useUserManagement } from "../hooks/useUserManagement";
import { useTableSearchParams } from "../hooks/useTableSearchParams";
import { useExtendTrial } from "../hooks/useExtendTrial";
import { tenantDetailKeys } from "../hooks/useTenantManagement";
import AuditLogsGrid from "../components/audit/AuditLogsGrid";
import SubscriptionHistoryGrid from "../components/subscription/SubscriptionHistoryGrid";
import InvoicesGrid from "../components/invoice/InvoicesGrid";
import TenantSeatsTable from "../components/TenantSeatsTable";
import TenantDetailsInfoCard from "../components/tenant/TenantDetailsInfoCard";
import TenantAccountActions from "../components/tenant/TenantAccountActions";
import TenantIndividualUserCard from "../components/tenant/TenantIndividualUserCard";
import RemoveTenantMemberDialog from "../components/tenant/RemoveTenantMemberDialog";
import { ApplicationUser, type Tenant } from "../models";
import type { SeatUserRow } from "../types/seatTable";
import { buildSeatUserRows } from "../utils/seatUserRows";
import { TenantRoleSlug } from "../types/tenantRole";
import { SubscriptionTierSlug } from "../types/subscriptionTier";
import {
  LayoutDashboard,
  Mail,
  Users,
  History,
  Receipt,
  FileText,
  Building2,
  AppWindow,
} from "lucide-react";
import {
  TabbedContentViewer,
  TabContent,
  type TabbedContentItem,
} from "../components/TabbedContentViewer";
import {
  StatisticsTile,
  type StatisticsTileProps,
} from "../components/StatisticsTile";

const SEAT_COLUMN_FILTER_TYPES: Record<string, ColumnFilterType> = {
  user: "text",
  status: "select",
};

const DEFAULT_SEAT_SORT = [{ id: "seatNumber", desc: false }] as const;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Please try again.";
}

const TenantDetail = () => {
  const navigate = useNavigate();
  const { tenantId } = useParams<{ tenantId: string }>();
  const { user: identityUser } = useIdentity();
  const { users, loadUsers } = useUserManagement(true);

  const [activeTabId, setActiveTabId] = useState("dashboard");
  const [removeMemberTarget, setRemoveMemberTarget] =
    useState<SeatUserRow | null>(null);
  const isGlobalAdmin = isGlobalAdministrator(identityUser);

  const {
    globalFilter,
    sorting,
    pagination,
    columnFilters,
    onGlobalFilterChange,
    onSortingChange,
    onPaginationChange,
    onColumnFiltersChange,
  } = useTableSearchParams({
    defaultSort: [...DEFAULT_SEAT_SORT],
    defaultPageSize: 10,
    columnFilterTypes: SEAT_COLUMN_FILTER_TYPES,
  });

  const tenantQuery = useQuery({
    queryKey: tenantDetailKeys.detail(tenantId ?? ""),
    queryFn: () => tenantApi.getTenantById(tenantId ?? ""),
    enabled: !!tenantId,
  });

  const usageQuery = useQuery({
    queryKey: tenantDetailKeys.usage(tenantId ?? ""),
    queryFn: () => tenantApi.getTenantUsageById(tenantId ?? ""),
    enabled: !!tenantId,
  });

  const allUsersQuery = useQuery({
    queryKey: tenantDetailKeys.users(tenantId ?? ""),
    queryFn: async () => {
      const allUsers = await userApi.getUsers();
      return allUsers.map((user) => new ApplicationUser(user));
    },
    enabled: !!tenantId,
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (request: IUpdateTenantRequest) => {
      return tenantApi.updateTenantById(tenantId ?? "", request);
    },
    onSuccess: async () => {
      toast({
        title: "Tenant updated",
        description: "Tenant details were updated successfully.",
      });
      await Promise.all([tenantQuery.refetch(), usageQuery.refetch()]);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to update tenant",
        description: describeError(error),
        variant: "destructive",
      });
    },
  });

  const { extendTrial, isExtending } = useExtendTrial({
    tenantId,
    onExtended: () => tenantQuery.refetch(),
  });

  const canLoadSeatData = useMemo(() => {
    if (!tenantId || !identityUser?.userId) {
      return false;
    }

    if (isGlobalAdmin) {
      return true;
    }

    const currentUser = (allUsersQuery.data ?? []).find(
      (candidate) => candidate.id === identityUser.userId,
    );

    return (
      currentUser?.tenantMembershipsSummary.some(
        (membership) =>
          membership.tenantId === tenantId &&
          membership.role === TenantRoleSlug.Admin,
      ) ?? false
    );
  }, [allUsersQuery.data, identityUser?.userId, isGlobalAdmin, tenantId]);

  // Global admins load via the admin-scoped endpoint (any tenant). Tenant
  // admins of this tenant fall back to the tenant-context endpoint, which
  // assumes their active session is on this tenant.
  const seatsOptions = useMemo<UseTeamSeatsOptions>(() => {
    if (!canLoadSeatData || !tenantId) {
      return { mode: "disabled" };
    }
    if (isGlobalAdmin) {
      return { mode: "admin", tenantId };
    }
    return { mode: "tenantContext" };
  }, [canLoadSeatData, isGlobalAdmin, tenantId]);

  const { seats, seatsLoading, seatsError } = useTeamSeats(seatsOptions);

  const isLoading =
    tenantQuery.isLoading || usageQuery.isLoading || seatsLoading;

  useEffect(() => {
    if (canLoadSeatData) {
      void loadUsers();
    }
  }, [canLoadSeatData, loadUsers]);

  const tenant = tenantQuery.data as Tenant | undefined;
  const usage = usageQuery.data;

  const isIndividualTier =
    (tenant?.subscriptionTier ?? "").toLowerCase() ===
    SubscriptionTierSlug.Individual;

  const individualOwner = useMemo(() => {
    if (!tenant?.ownerId) {
      return undefined;
    }
    return (allUsersQuery.data ?? []).find(
      (candidate) => candidate.id === tenant.ownerId,
    );
  }, [allUsersQuery.data, tenant?.ownerId]);

  const ownerOptions = useMemo(() => {
    if (!tenantId) {
      return [] as ApplicationUser[];
    }

    const sourceUsers = allUsersQuery.data ?? [];
    return sourceUsers
      .filter((user) =>
        user.tenantMembershipsSummary.some(
          (membership) => membership.tenantId === tenantId,
        ),
      )
      .sort((left, right) =>
        (left.fullName || left.email).localeCompare(
          right.fullName || right.email,
        ),
      );
  }, [allUsersQuery.data, tenantId]);

  const ownerDisplay = useMemo(() => {
    if (!tenant?.ownerId) {
      return "Not assigned";
    }

    const match = (allUsersQuery.data ?? []).find(
      (candidate) => candidate.id === tenant.ownerId,
    );
    if (!match) {
      return tenant.ownerId;
    }

    return match.fullName || match.email;
  }, [allUsersQuery.data, tenant?.ownerId]);

  const seatRows = useMemo<SeatUserRow[]>(
    () =>
      buildSeatUserRows({
        seats,
        users: [...users, ...(allUsersQuery.data ?? [])],
        tenantId,
        ownerId: tenant?.ownerId,
      }),
    [seats, users, allUsersQuery.data, tenantId, tenant?.ownerId],
  );

  const formatUsageLimit = (used: number, max: number): string =>
    max === 0 ? `${used} / ∞` : `${used} / ${max}`;

  const handleSaveTenant = useCallback(
    async (request: IUpdateTenantRequest) => {
      if (!tenantId) {
        return;
      }
      await updateTenantMutation.mutateAsync(request);
    },
    [tenantId, updateTenantMutation],
  );

  const handleViewUser = useCallback(
    (userId: string) => {
      navigate(`/administration/users/${userId}`);
    },
    [navigate],
  );

  const usageTiles: StatisticsTileProps[] = [
    {
      title: "Users",
      value: usage ? formatUsageLimit(usage.userCount, usage.maxUsers) : "-",
      change: "",
      icon: Users,
      iconClassName: "bg-primary/10 text-primary",
    },
    {
      title: "Apps",
      value: usage
        ? formatUsageLimit(usage.appCount, usage.maxPublishedApps)
        : "-",
      change: "",
      icon: AppWindow,
      iconClassName: "bg-primary/10 text-primary",
    },
    {
      title: "Workspace Connections",
      value: usage
        ? formatUsageLimit(
            usage.connectionCount,
            usage.maxWorkspaceConnections,
          )
        : "-",
      change: "",
      icon: Building2,
      iconClassName: "bg-primary/10 text-primary",
    },
  ].filter((tile) => !(isIndividualTier && tile.title === "Users"));

  const tabbedContentItems: TabbedContentItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "seats",
      label: "Seats",
      icon: Users,
    },
    {
      id: "activity",
      label: "Activity Log",
      icon: History,
    },
    {
      id: "subscription-history",
      label: "Subscription History",
      icon: Receipt,
    },
    {
      id: "invoices",
      label: "Invoices",
      icon: FileText,
    },
  ];

  return (
    <section className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <ManagementPageHeader
          title={tenant?.displayName ?? "Tenant Detail"}
          id="tenant-detail-header"
          content={
            tenant ? (
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-primary/15 to-primary/5 text-2xl font-bold text-primary shadow-sm">
                  <Building2 />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">
                      {tenant?.displayName ?? "Tenant Detail"}
                    </h2>
                    <Chip
                      variant={tenant?.isActive ? "success" : "destructive"}
                    >
                      {tenant?.isActive ? "Active" : "Inactive"}
                    </Chip>
                  </div>
                  <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {tenant?.invoiceEmail ?? "N/A"}
                    </div>
                    <div className="hidden h-1 w-1 rounded-full bg-muted sm:block"></div>
                    <div className="flex items-center gap-1">
                      {tenant?.subscriptionTier
                        ? `${tenant.subscriptionTier} Plan`
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              "Loading tenant details..."
            )
          }
          actions={null}
        />

        {tenantQuery.isError && (
          <div className="rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
            Failed to load tenant details.
          </div>
        )}

        <TabbedContentViewer
          id="tenant-tabs"
          tabs={tabbedContentItems}
          defaultTabId="dashboard"
          activeTabId={activeTabId}
          onTabChange={setActiveTabId}
        >
          <TabContent id="dashboard">
            <div className="space-y-6 lg:col-span-2">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                {isIndividualTier && (
                  <TenantIndividualUserCard
                    ownerId={tenant?.ownerId}
                    owner={individualOwner}
                    ownerDisplay={ownerDisplay}
                    onView={handleViewUser}
                  />
                )}
                {usageTiles.map((stat) => (
                  <StatisticsTile
                    key={stat.title}
                    title={stat.title}
                    value={stat.value}
                    change={stat.change}
                    change2={stat.change2}
                    trend={stat.trend}
                    icon={stat.icon}
                    iconClassName={stat.iconClassName}
                    loading={isLoading}
                  />
                ))}
              </div>

              {tenant && (
                <TenantDetailsInfoCard
                  tenant={tenant}
                  ownerOptions={ownerOptions}
                  ownerDisplay={ownerDisplay}
                  saving={updateTenantMutation.isPending}
                  onSave={handleSaveTenant}
                  canExtendTrial={isGlobalAdmin}
                  extendingTrial={isExtending}
                  onExtendTrial={extendTrial}
                />
              )}

              {tenant && isGlobalAdmin && (
                <TenantAccountActions
                  tenant={tenant}
                  onTenantChanged={async () => {
                    await Promise.all([
                      tenantQuery.refetch(),
                      usageQuery.refetch(),
                    ]);
                  }}
                />
              )}
            </div>
          </TabContent>

          <TabContent id="seats">
            <div className="space-y-6 lg:col-span-2">
              {seatsError && canLoadSeatData ? (
                <div className="rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
                  {seatsError}
                </div>
              ) : null}

              {canLoadSeatData ? (
                <TenantSeatsTable
                  rows={seatRows}
                  loading={seatsLoading || allUsersQuery.isLoading}
                  globalFilter={globalFilter}
                  onGlobalFilterChange={onGlobalFilterChange}
                  sorting={sorting}
                  onSortingChange={onSortingChange}
                  pagination={pagination}
                  onPaginationChange={onPaginationChange}
                  columnFilters={columnFilters}
                  onColumnFiltersChange={onColumnFiltersChange}
                  onViewUser={handleViewUser}
                  showSeatManagementActions={false}
                  ownerId={tenant?.ownerId}
                  currentUserId={identityUser?.userId}
                  onRemoveFromTenant={
                    isGlobalAdmin && tenant ? setRemoveMemberTarget : undefined
                  }
                  onRowClick={(row) => {
                    if (row.user) {
                      handleViewUser(row.user.id);
                    }
                  }}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Seats</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Seat details are currently scoped to the active tenant
                    context. To review this tenant&apos;s seats, switch into this
                    tenant context first.
                  </CardContent>
                </Card>
              )}

              {tenantId && isGlobalAdmin ? (
                <RemoveTenantMemberDialog
                  tenantId={tenantId}
                  tenantName={tenant?.displayName}
                  target={removeMemberTarget}
                  onOpenChange={(open) => {
                    if (!open) setRemoveMemberTarget(null);
                  }}
                />
              ) : null}
            </div>
          </TabContent>

          <TabContent id="activity">
            {tenantId ? (
              <AuditLogsGrid scope={{ kind: "tenant", tenantId }} />
            ) : null}
          </TabContent>

          <TabContent id="subscription-history">
            {tenantId ? <SubscriptionHistoryGrid tenantId={tenantId} /> : null}
          </TabContent>

          <TabContent id="invoices">
            {tenantId ? <InvoicesGrid tenantId={tenantId} /> : null}
          </TabContent>
        </TabbedContentViewer>
      </div>
    </section>
  );
};

export default TenantDetail;
