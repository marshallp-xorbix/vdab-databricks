import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AccountActionsSection } from "../account/AccountActionsSection";
import { ConfirmActionDialog } from "../account/ConfirmActionDialog";
import TypeToConfirmDialog from "../account/TypeToConfirmDialog";
import { Button } from "../ui/button";
import { toast } from "../ui/use-toast";
import { tenantApi } from "../../api/TenantApi";
import { useTenantStatusActions } from "../../hooks/useTenantStatusActions";
import { tenantManagementKeys, tenantDetailKeys } from "../../hooks/useTenantManagement";
import { parseError } from "../../lib/utils";
import type { Tenant } from "../../models";

type DialogKind =
  | "deactivate"
  | "reactivate"
  | "cancelSubscription"
  | "softDelete"
  | "purge"
  | null;

interface ITenantAccountActionsProps {
  tenant: Tenant;
  onTenantChanged: () => Promise<void> | void;
}

function TenantAccountActions({
  tenant,
  onTenantChanged,
}: Readonly<ITenantAccountActionsProps>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const closeDialog = useCallback(() => setDialog(null), []);

  const showActionError = useCallback((title: string, error: unknown) => {
    toast({
      title,
      description: parseError(error).message || "Please try again.",
      variant: "destructive",
    });
  }, []);

  const completeTenantRemoval = useCallback(
    async (title: string, description: string) => {
      toast({ title, description });
      closeDialog();
      queryClient.setQueryData<Tenant[]>(
        tenantManagementKeys.list(),
        (current) =>
          current?.filter((entry) => entry.tenantId !== tenant.tenantId) ??
          current,
      );
      queryClient.removeQueries({ queryKey: tenantDetailKeys.detail(tenant.tenantId) });
      await queryClient.invalidateQueries({
        queryKey: tenantManagementKeys.all,
      });
      navigate("/administration/tenants");
    },
    [closeDialog, navigate, queryClient, tenant.tenantId],
  );

  const { deactivate, reactivate, isDeactivating, isReactivating } =
    useTenantStatusActions({
      onChanged: async () => {
        closeDialog();
        await onTenantChanged();
      },
    });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: () =>
      tenantApi.cancelTenantSubscription(tenant.tenantId, false),
    onSuccess: async () => {
      toast({
        title: "Subscription canceled",
        description: "Stripe subscription will end at the current period end.",
      });
      closeDialog();
      await onTenantChanged();
    },
    onError: (error: unknown) => {
      showActionError("Failed to cancel subscription", error);
    },
  });

  const softDeleteMutation = useMutation({
    mutationFn: () => tenantApi.softDeleteTenant(tenant.tenantId),
    onSuccess: async () => {
      await completeTenantRemoval(
        "Tenant deleted",
        `${tenant.displayName} has been soft-deleted.`,
      );
    },
    onError: (error: unknown) => {
      showActionError("Failed to delete tenant", error);
    },
  });

  const purgeMutation = useMutation({
    mutationFn: () => tenantApi.purgeTenantData(tenant.tenantId),
    onSuccess: async () => {
      await completeTenantRemoval(
        "Tenant data purged",
        `${tenant.displayName} and all related data have been permanently deleted.`,
      );
    },
    onError: (error: unknown) => {
      showActionError("Failed to purge tenant", error);
    },
  });

  const anyPending =
    isDeactivating ||
    isReactivating ||
    cancelSubscriptionMutation.isPending ||
    softDeleteMutation.isPending ||
    purgeMutation.isPending;

  return (
    <>
      <AccountActionsSection
        title="Tenant Actions"
        description="Administrative controls for this tenant. Destructive actions cancel the Stripe subscription, soft-delete related records, and disable users whose only tenant is this one."
        layout="grid"
      >
        {tenant.isActive ? (
          <Button
            variant="outline"
            disabled={anyPending}
            onClick={() => setDialog("deactivate")}
          >
            Deactivate Tenant
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={anyPending}
            onClick={() => setDialog("reactivate")}
          >
            Reactivate Tenant
          </Button>
        )}

        <Button
          variant="outline"
          disabled={anyPending || !tenant.stripeSubscriptionId}
          onClick={() => setDialog("cancelSubscription")}
        >
          Cancel Subscription
        </Button>

        <Button
          variant="destructive"
          disabled={anyPending}
          onClick={() => setDialog("softDelete")}
        >
          Delete Tenant
        </Button>

        <Button
          variant="destructive"
          disabled={anyPending}
          onClick={() => setDialog("purge")}
        >
          Delete Tenant and All Data
        </Button>
      </AccountActionsSection>

      <ConfirmActionDialog
        open={dialog === "deactivate"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Deactivate Tenant?"
        description={`Mark '${tenant.displayName}' inactive and cancel its Stripe subscription at period end. Sole-tenant user sessions will be revoked. This is reversible.`}
        confirmLabel="Deactivate"
        confirmVariant="default"
        onConfirm={() => deactivate(tenant)}
      />

      <ConfirmActionDialog
        open={dialog === "reactivate"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Reactivate Tenant?"
        description={`Restore '${tenant.displayName}' to active status. The Stripe subscription is not automatically resurrected — billing must be re-established separately.`}
        confirmLabel="Reactivate"
        confirmVariant="default"
        onConfirm={() => reactivate(tenant)}
      />

      <ConfirmActionDialog
        open={dialog === "cancelSubscription"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Cancel Subscription?"
        description={`Cancel the Stripe subscription for '${tenant.displayName}' at the end of the current billing period. The tenant remains active until then.`}
        confirmLabel="Cancel Subscription"
        confirmVariant="destructive"
        onConfirm={() => cancelSubscriptionMutation.mutate()}
      />

      <TypeToConfirmDialog
        open={dialog === "softDelete"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Delete Tenant?"
        description={`Cancel Stripe immediately, soft-delete the tenant, memberships, apps, Databricks connections, seats, and pending invites. Users whose only tenant is this one will be disabled and their sessions revoked. Data is retained in the database.`}
        confirmationPhrase={tenant.tenantName}
        confirmLabel="Delete Tenant"
        isPending={softDeleteMutation.isPending}
        onConfirm={() => softDeleteMutation.mutate()}
      />

      <TypeToConfirmDialog
        open={dialog === "purge"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Delete Tenant and All Data?"
        description={`Permanently delete '${tenant.displayName}' and all related data (apps, connections, seats, invites, memberships, preferences, billing history, audit logs, and Stripe event logs). Sole-tenant users are disabled but not deleted. This cannot be undone.`}
        confirmationPhrase={tenant.tenantName}
        confirmLabel="Delete Tenant and All Data"
        isPending={purgeMutation.isPending}
        onConfirm={() => purgeMutation.mutate()}
      />
    </>
  );
}

export default TenantAccountActions;
