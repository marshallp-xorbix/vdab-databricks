import { useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import { ManagementPageHeader } from "../components/ManagementPageHeader";
import { Button } from "../components/ui/button";
import { DataTable } from "../components/ui/data-table";
import { ConfirmActionDialog } from "../components/account/ConfirmActionDialog";
import { useTenantManagement } from "../hooks/useTenantManagement";
import { useTableSearchParams } from "../hooks/useTableSearchParams";
import { useTenantStatusActions } from "../hooks/useTenantStatusActions";
import type { ColumnFilterType } from "../components/ui/data-table";
import { getTenantColumns } from "./tenantColumns";
import TenantManagementToolbar, {
  type TenantStatusFilter,
} from "./TenantManagementToolbar";
import type { Tenant } from "../models";

const COLUMN_FILTER_TYPES: Record<string, ColumnFilterType> = {
  tenant: "text",
  subscriptionTier: "select",
  status: "select",
  created: "date",
};

const DEFAULT_SORT = [{ id: "tenant", desc: false }] as const;

const TENANT_STATUS_VALUES = new Set<TenantStatusFilter>([
  "active",
  "inactive",
]);

const TenantManagement = () => {
  const navigate = useNavigate();
  const { tenants, isLoading, isError, error, refetch } = useTenantManagement();

  const [statusDialogTenant, setStatusDialogTenant] = useState<Tenant | null>(
    null,
  );

  const closeStatusDialog = useCallback(() => setStatusDialogTenant(null), []);

  const { deactivate, reactivate } = useTenantStatusActions({
    onChanged: async () => {
      closeStatusDialog();
      await refetch();
    },
  });

  const {
    globalFilter,
    sorting,
    pagination,
    columnFilters,
    onGlobalFilterChange,
    onSortingChange,
    onPaginationChange,
    onColumnFiltersChange,
    getListParam,
    setListParam,
    setListParams,
  } = useTableSearchParams({
    defaultSort: [...DEFAULT_SORT],
    defaultPageSize: 10,
    columnFilterTypes: COLUMN_FILTER_TYPES,
  });

  const statusFilters = getListParam("status") as TenantStatusFilter[];
  const subscriptionTierFilters = getListParam("subscriptionTier");

  const setStatusFilters = useCallback(
    (values: TenantStatusFilter[]) => {
      const validValues = values.filter((value) =>
        TENANT_STATUS_VALUES.has(value),
      );
      setListParam("status", validValues);
    },
    [setListParam],
  );

  const setSubscriptionTierFilters = useCallback(
    (values: string[]) => {
      setListParam("subscriptionTier", values);
    },
    [setListParam],
  );

  const clearToolbarFilters = useCallback(() => {
    setListParams({
      status: [],
      subscriptionTier: [],
    });
  }, [setListParams]);

  const availableSubscriptionTiers = useMemo(() => {
    const tierSet = new Set<string>();

    for (const tenant of tenants) {
      if (tenant.subscriptionTier) {
        tierSet.add(tenant.subscriptionTier);
      }
    }

    return Array.from(tierSet).sort((left, right) => left.localeCompare(right));
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const tenantStatus: TenantStatusFilter = tenant.isActive
        ? "active"
        : "inactive";

      if (statusFilters.length > 0 && !statusFilters.includes(tenantStatus)) {
        return false;
      }

      if (
        subscriptionTierFilters.length > 0 &&
        !subscriptionTierFilters.includes(tenant.subscriptionTier)
      ) {
        return false;
      }

      return true;
    });
  }, [tenants, statusFilters, subscriptionTierFilters]);

  const handleViewTenant = useCallback(
    (tenant: Tenant) => {
      navigate(`/administration/tenants/${tenant.tenantId}`);
    },
    [navigate],
  );

  const handleAddTenant = useCallback(() => {
    navigate("/administration/tenants/new");
  }, [navigate]);

  const handleDeactivateTenant = useCallback((tenant: Tenant) => {
    setStatusDialogTenant(tenant);
  }, []);

  const handleReactivateTenant = useCallback((tenant: Tenant) => {
    setStatusDialogTenant(tenant);
  }, []);

  const columns = useMemo(
    () =>
      getTenantColumns({
        onView: handleViewTenant,
        onDeactivate: handleDeactivateTenant,
        onReactivate: handleReactivateTenant,
      }),
    [handleViewTenant, handleDeactivateTenant, handleReactivateTenant],
  );

  return (
    <section className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <ManagementPageHeader
          title="Tenant Management"
          description="Manage tenant accounts, subscription tiers, and account status."
          actions={
            <>
              <Button variant="outline" disabled className="rounded-lg">
                <Download className="mr-2 h-4 w-4" />
                Export
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Soon
                </span>
              </Button>
              <Button
                onClick={handleAddTenant}
                className="bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Tenant
              </Button>
            </>
          }
        />

        {isError && (
          <div className="rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
            {error instanceof Error
              ? error.message
              : "Failed to load tenants. Please try again."}
          </div>
        )}

        <div id="tenant-table">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"></div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredTenants}
              globalFilter={globalFilter}
              onGlobalFilterChange={onGlobalFilterChange}
              sorting={sorting}
              onSortingChange={onSortingChange}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              columnFilters={columnFilters}
              onColumnFiltersChange={onColumnFiltersChange}
              onRowClick={(tenant) => handleViewTenant(tenant)}
              toolbar={
                <TenantManagementToolbar
                  searchTerm={globalFilter}
                  onSearchChange={onGlobalFilterChange}
                  statusFilters={statusFilters}
                  onStatusFiltersChange={setStatusFilters}
                  subscriptionTierFilters={subscriptionTierFilters}
                  onSubscriptionTierFiltersChange={setSubscriptionTierFilters}
                  availableSubscriptionTiers={availableSubscriptionTiers}
                  onClearFilters={clearToolbarFilters}
                />
              }
            />
          )}
        </div>
      </div>

      <ConfirmActionDialog
        open={!!statusDialogTenant?.isActive}
        onOpenChange={(open) => !open && closeStatusDialog()}
        title="Deactivate Tenant?"
        description={
          statusDialogTenant
            ? `Mark '${statusDialogTenant.displayName}' inactive and cancel its Stripe subscription at period end. Sole-tenant user sessions will be revoked. This is reversible.`
            : ""
        }
        confirmLabel="Deactivate"
        confirmVariant="default"
        onConfirm={() => {
          if (statusDialogTenant) {
            deactivate(statusDialogTenant);
          }
        }}
      />

      <ConfirmActionDialog
        open={!!statusDialogTenant && !statusDialogTenant.isActive}
        onOpenChange={(open) => !open && closeStatusDialog()}
        title="Reactivate Tenant?"
        description={
          statusDialogTenant
            ? `Restore '${statusDialogTenant.displayName}' to active status. The Stripe subscription is not automatically resurrected — billing must be re-established separately.`
            : ""
        }
        confirmLabel="Reactivate"
        confirmVariant="default"
        onConfirm={() => {
          if (statusDialogTenant) {
            reactivate(statusDialogTenant);
          }
        }}
      />
    </section>
  );
};

export default TenantManagement;
