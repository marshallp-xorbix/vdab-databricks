import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import { useUserManagement } from "../hooks/useUserManagement";
import { useIdentity } from "../context/IdentityContext";
import { TenantRoleSlug } from "../types/tenantRole";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { ManagementPageHeader } from "../components/ManagementPageHeader";
import { ApplicationUser } from "../models";
import { DataTable } from "../components/ui/data-table";
import { getUserColumns, resolveUserStatus } from "./userColumns";
import { useTenantContext } from "../hooks/useTenantContext";
import {
  UserManagementToolbar,
  type UserAudienceFilter,
  type UserStatusFilter,
} from "./UserManagementToolbar";
import { useTableSearchParams } from "../hooks/useTableSearchParams";
import type { ColumnFilterType } from "../components/ui/data-table";

const COLUMN_FILTER_TYPES: Record<string, ColumnFilterType> = {
  user: "text",
  roles: "select",
  status: "select",
  lastLogin: "date",
};

const DEFAULT_SORT = [{ id: "user", desc: false }] as const;

const STATUS_VALUES = new Set<UserStatusFilter>([
  "active",
  "inactive",
  "suspended",
  "unconfirmed",
  "removed",
]);
const USER_AUDIENCE_VALUES = new Set<UserAudienceFilter>([
  "all",
  "customers",
  "admins",
]);

function isGlobalAdministrator(user: ApplicationUser): boolean {
  return user.roles.some((role) => role.toLowerCase() === "administrator");
}

function getUserStatus(
  user: ApplicationUser,
  currentTenantId?: string | null,
): UserStatusFilter {
  const status = resolveUserStatus(user, currentTenantId);
  switch (status) {
    case "Removed":
      return "removed";
    case "Inactive":
      return "inactive";
    case "Suspended in this workspace":
      return "suspended";
    case "Active":
      return "active";
    default:
      return "unconfirmed";
  }
}

function UserManagement() {
  const navigate = useNavigate();
  const { user: identityUser } = useIdentity();
  const { currentTenant } = useTenantContext();
  const isGlobalAdmin =
    identityUser?.roles.includes(TenantRoleSlug.Administrator) ?? false;
  const {
    users,
    loading,
    error,
    loadUsers,
    loadRetiredUsers,
    deactivateUser: deactivateUserAction,
    reactivateUser: reactivateUserAction,
  } = useUserManagement(true);
  const [deactivateTarget, setDeactivateTarget] =
    useState<ApplicationUser | null>(null);

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

  const roleFilters = getListParam("roles");
  const statusFilters = getListParam("status") as UserStatusFilter[];
  const userAudienceParam = getListParam("audience")[0];
  const userAudienceFilter: UserAudienceFilter = USER_AUDIENCE_VALUES.has(
    userAudienceParam as UserAudienceFilter,
  )
    ? (userAudienceParam as UserAudienceFilter)
    : "all";

  const showRemovedOnly =
    isGlobalAdmin && statusFilters.includes("removed");

  const setRoleFilters = useCallback(
    (values: string[]) => setListParam("roles", values),
    [setListParam],
  );

  const setStatusFilters = useCallback(
    (values: UserStatusFilter[]) => {
      const valid = values.filter((v) => STATUS_VALUES.has(v));
      // Selecting Removed & deleted is exclusive — it loads a different data source.
      if (valid.includes("removed")) {
        setListParam("status", ["removed"]);
        return;
      }
      setListParam(
        "status",
        valid.filter((v) => v !== "removed"),
      );
    },
    [setListParam],
  );

  const setUserAudienceFilter = useCallback(
    (value: UserAudienceFilter) => {
      if (value === "all") {
        setListParam("audience", []);
        return;
      }

      setListParam("audience", [value]);
    },
    [setListParam],
  );

  const clearToolbarFilters = useCallback(() => {
    setListParams({
      audience: [],
      roles: [],
      status: [],
    });
  }, [setListParams]);

  useEffect(() => {
    if (showRemovedOnly) {
      void loadRetiredUsers();
    } else {
      void loadUsers();
    }
  }, [showRemovedOnly, loadUsers, loadRetiredUsers]);

  const handleViewUser = useCallback(
    (userId: string) => {
      navigate(`/administration/users/${userId}`);
    },
    [navigate],
  );

  const handleAddUser = () => {
    navigate("/administration/users/new");
  };

  const handleDeactivateUser = async () => {
    if (!deactivateTarget) return;
    const success = await deactivateUserAction(
      deactivateTarget.id,
      deactivateTarget.fullName || deactivateTarget.email,
    );
    if (success) {
      setDeactivateTarget(null);
      if (showRemovedOnly) {
        await loadRetiredUsers();
      } else {
        await loadUsers();
      }
    }
  };

  const handleReactivateUser = useCallback(
    async (userId: string) => {
      const success = await reactivateUserAction(userId);
      if (success) {
        if (showRemovedOnly) {
          await loadRetiredUsers();
        } else {
          await loadUsers();
        }
      }
    },
    [
      reactivateUserAction,
      loadUsers,
      loadRetiredUsers,
      showRemovedOnly,
    ],
  );

  const columns = useMemo(
    () =>
      getUserColumns(
        {
          onView: handleViewUser,
          onDeactivate: setDeactivateTarget,
          onReactivate: (userId: string) => {
            void handleReactivateUser(userId);
          },
        },
        currentTenant?.tenantId,
      ),
    [handleViewUser, handleReactivateUser, currentTenant?.tenantId],
  );

  const availableRoles = useMemo(() => {
    const roleSet = new Set<string>();
    for (const user of users) {
      for (const role of user.roles) {
        roleSet.add(role);
      }
    }
    return Array.from(roleSet).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const userIsAdmin = isGlobalAdministrator(user);
      if (userAudienceFilter === "admins" && !userIsAdmin) {
        return false;
      }
      if (userAudienceFilter === "customers" && userIsAdmin) {
        return false;
      }
      if (
        roleFilters.length > 0 &&
        !user.roles.some((r) => roleFilters.includes(r))
      ) {
        return false;
      }
      if (
        statusFilters.length > 0 &&
        !statusFilters.includes(getUserStatus(user, currentTenant?.tenantId))
      ) {
        return false;
      }
      return true;
    });
  }, [users, userAudienceFilter, roleFilters, statusFilters, currentTenant?.tenantId]);

  return (
    <section className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <ManagementPageHeader
          title="User Management"
          description="Manage users, roles, and account settings."
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
                onClick={handleAddUser}
                className="bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </>
          }
        />

        {error && (
          <div className="rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <div id="user-table">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"></div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredUsers}
              globalFilter={globalFilter}
              onGlobalFilterChange={onGlobalFilterChange}
              sorting={sorting}
              onSortingChange={onSortingChange}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              columnFilters={columnFilters}
              onColumnFiltersChange={onColumnFiltersChange}
              onRowClick={(user) => handleViewUser(user.id)}
              toolbar={
                <UserManagementToolbar
                  searchTerm={globalFilter}
                  onSearchChange={onGlobalFilterChange}
                  roleFilters={roleFilters}
                  onRoleFiltersChange={setRoleFilters}
                  statusFilters={statusFilters}
                  onStatusFiltersChange={setStatusFilters}
                  userAudienceFilter={userAudienceFilter}
                  onUserAudienceFilterChange={setUserAudienceFilter}
                  availableRoles={availableRoles}
                  onClearFilters={clearToolbarFilters}
                  showRemovedFilter={isGlobalAdmin}
                />
              }
            />
          )}
        </div>
      </div>

      <Dialog
        open={!!deactivateTarget}
        onOpenChange={() => setDeactivateTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              {`Are you sure you want to deactivate ${deactivateTarget?.fullName || deactivateTarget?.email}? They will not be able to log in.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivateUser}>
              Deactivate User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default UserManagement;
