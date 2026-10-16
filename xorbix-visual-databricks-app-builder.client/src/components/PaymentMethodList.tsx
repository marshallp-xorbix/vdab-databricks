import { useState } from "react";
import { CreditCard, Star, Trash2, Loader2 } from "lucide-react";
import type { PaymentMethod } from "../models";
import { billingApi } from "../providers/BillingApi";
import { AuthButton } from "./AuthButton";

interface PaymentMethodListProps {
  paymentMethods: PaymentMethod[];
  onUpdated: () => void;
}

function brandIcon(brand: string): string {
  const icons: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    diners: "Diners",
    jcb: "JCB",
    unionpay: "UnionPay",
  };
  return icons[brand.toLowerCase()] || brand;
}

/**
 * Displays a list of saved payment methods with set-default and remove actions.
 */
export function PaymentMethodList({
  paymentMethods,
  onUpdated,
}: Readonly<PaymentMethodListProps>) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (paymentMethods.length === 0) {
    return null;
  }

  async function handleSetDefault(id: string) {
    setLoadingId(id);
    try {
      await billingApi.setDefaultPaymentMethod(id);
      onUpdated();
    } catch {
      // Error handled by caller refresh
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRemove(id: string) {
    setLoadingId(id);
    try {
      await billingApi.removePaymentMethod(id);
      onUpdated();
    } catch {
      // Error handled by caller refresh
    } finally {
      setLoadingId(null);
    }
  }

  // A payment method can only be removed when at least one other method
  // remains. This prevents a user from deleting their last card and leaving
  // the subscription with no way to bill. To replace the only card, add the
  // new one first, then remove the old.
  const canRemove = paymentMethods.length > 1;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Saved payment methods
      </p>
      {!canRemove && (
        <p className="text-xs text-muted-foreground">
          To replace your card, add a new payment method first, then remove the
          old one.
        </p>
      )}
      {paymentMethods.map((pm) => (
        <div
          key={pm.id}
          className="flex items-center justify-between rounded-md border border-border px-3 py-2"
        >
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{brandIcon(pm.brand)}</span>
            <span className="text-muted-foreground">
              ****{pm.last4} &middot; {pm.expMonth}/{pm.expYear}
            </span>
            {pm.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Star className="h-3 w-3" /> Default
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {loadingId === pm.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                {!pm.isDefault && (
                  <AuthButton
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleSetDefault(pm.id)}
                  >
                    Set default
                  </AuthButton>
                )}
                {canRemove && (
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleRemove(pm.id)}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
