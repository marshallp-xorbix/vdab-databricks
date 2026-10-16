import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, Plus } from "lucide-react";
import type { PaymentMethod } from "../models";
import { billingApi } from "../providers/BillingApi";
import { StripeProvider } from "./StripeProvider";
import {
  PaymentMethodForm,
  type PaymentMethodFormHandle,
} from "./PaymentMethodForm";
import { PaymentMethodList } from "./PaymentMethodList";
import { Button } from "./ui/button";
import { useLogger } from "../logger/useLogger";

interface PaymentMethodSectionProps {
  onPaymentMethodSaved?: () => void;
  onPaymentMethodCountChange?: (count: number) => void;
  /**
   * When true, the internal "Save Payment Method" button and the
   * "Add Payment Method" / "Cancel" toggle are hidden. The parent is
   * expected to drive saving via the imperative ref.
   */
  hideSubmitButton?: boolean;
}

export interface PaymentMethodSectionHandle {
  /**
   * If a saved payment method already exists, resolves immediately with
   * success. Otherwise confirms the entered card via the SetupIntent and
   * refreshes the list.
   */
  saveIfNeeded: (options?: {
    optional?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Combined section: shows existing payment methods and a form to add new ones.
 * Manages SetupIntent lifecycle and payment method list refresh.
 */
export const PaymentMethodSection = forwardRef<
  PaymentMethodSectionHandle,
  PaymentMethodSectionProps
>(function PaymentMethodSection(
  {
    onPaymentMethodSaved,
    onPaymentMethodCountChange,
    hideSubmitButton = false,
  },
  ref,
) {
  const logger = useLogger("PaymentMethodSection");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);

  const formRef = useRef<PaymentMethodFormHandle>(null);

  const loadData = useCallback(async () => {
    try {
      logger.UI.log("loadData: requesting setup intent and payment methods");
      const [setupIntent, methods] = await Promise.all([
        billingApi.createSetupIntent(),
        billingApi.getPaymentMethods(),
      ]);
      logger.UI.log("loadData: loaded", {
        hasClientSecret: !!setupIntent.clientSecret,
        methodCount: methods.length,
        hasDefault: methods.some((m) => m.isDefault),
      });
      setClientSecret(setupIntent.clientSecret);
      setPaymentMethods(methods);
      setShowForm(methods.length === 0);
      onPaymentMethodCountChange?.(methods.length);
      setError(null);
    } catch (ex) {
      logger.handleError(ex, "PaymentMethodSection.loadData");
      setError("Failed to load payment information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [onPaymentMethodCountChange, logger]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshAfterSave = useCallback(async () => {
    logger.UI.log("refreshAfterSave: started");
    setLoading(true);
    await loadData();

    // Auto-set default if no default exists after refresh
    const refreshedMethods = await billingApi.getPaymentMethods();
    if (
      refreshedMethods.length > 0 &&
      !refreshedMethods.some((m) => m.isDefault)
    ) {
      logger.UI.log(
        "refreshAfterSave: auto-promoting first payment method to default",
        { paymentMethodId: refreshedMethods[0].id },
      );
      await billingApi.setDefaultPaymentMethod(refreshedMethods[0].id);
      await loadData();
    } else {
      logger.UI.log("refreshAfterSave: existing default retained", {
        methodCount: refreshedMethods.length,
      });
    }

    setShowForm(false);
    onPaymentMethodSaved?.();
  }, [loadData, onPaymentMethodSaved, logger]);

  useImperativeHandle(
    ref,
    () => ({
      async saveIfNeeded(options?: { optional?: boolean }) {
        logger.UI.log("saveIfNeeded: called", {
          methodCount: paymentMethods.length,
          showForm,
          optional: options?.optional ?? false,
        });
        if (paymentMethods.length > 0 && !showForm) {
          logger.UI.log(
            "saveIfNeeded: short-circuit — payment method already saved",
          );
          return { success: true };
        }
        if (!formRef.current) {
          logger.UI.warn("saveIfNeeded: form ref not ready");
          return {
            success: false,
            error: "Payment form is not ready. Please try again.",
          };
        }
        logger.UI.log("saveIfNeeded: submitting payment form");
        const result = options?.optional
          ? await formRef.current.submitOptional()
          : await formRef.current.submit();
        logger.UI.log("saveIfNeeded: form.submit returned", {
          success: result.success,
          hasError: !!result.error,
        });
        if (result.success && result.saved !== false) {
          await refreshAfterSave();
        }
        return result;
      },
    }),
    [paymentMethods, showForm, refreshAfterSave, logger],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment information...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground">
        {error}
      </div>
    );
  }

  const hasPaymentMethods = paymentMethods.length > 0;

  return (
    <div className="space-y-6">
      <PaymentMethodList
        paymentMethods={paymentMethods}
        onUpdated={() => void loadData()}
      />

      {showForm && clientSecret ? (
        <div className="space-y-2">
          <StripeProvider clientSecret={clientSecret}>
            <PaymentMethodForm
              ref={formRef}
              hideSubmitButton={hideSubmitButton}
              onSuccess={() => void refreshAfterSave()}
              submitLabel={
                hasPaymentMethods ? "Add Payment Method" : "Save Payment Method"
              }
            />
          </StripeProvider>
          {!hideSubmitButton && hasPaymentMethods && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      ) : (
        !hideSubmitButton &&
        hasPaymentMethods && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </Button>
        )
      )}
    </div>
  );
});
