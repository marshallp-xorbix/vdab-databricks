import { forwardRef, useImperativeHandle, useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { AuthButton } from "./AuthButton";
import { useLogger } from "../logger/useLogger";

interface PaymentMethodFormProps {
  onSuccess?: () => void;
  submitLabel?: string;
  /** Hide the internal submit button; parent triggers save via ref. */
  hideSubmitButton?: boolean;
}

export interface PaymentMethodFormHandle {
  /** Imperatively confirms the SetupIntent. Returns success/error. */
  submit: () => Promise<{ success: boolean; error?: string; saved?: boolean }>;
  /**
   * Saves the card when entered; returns success without confirming when the
   * payment element is empty (optional-card flows).
   */
  submitOptional: () => Promise<{ success: boolean; error?: string; saved?: boolean }>;
}

/**
 * Stripe PaymentElement form for collecting payment method details.
 * Must be rendered inside a StripeProvider (Elements context).
 */
export const PaymentMethodForm = forwardRef<
  PaymentMethodFormHandle,
  PaymentMethodFormProps
>(function PaymentMethodForm(
  { onSuccess, submitLabel = "Save Payment Method", hideSubmitButton = false },
  ref,
) {
  const stripe = useStripe();
  const elements = useElements();
  const logger = useLogger("PaymentMethodForm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [paymentEmpty, setPaymentEmpty] = useState(true);

  async function confirm(): Promise<{ success: boolean; error?: string; saved?: boolean }> {
    setError(null);
    logger.UI.log("confirm: started", {
      stripeReady: !!stripe,
      elementsReady: !!elements,
      paymentElementReady: ready,
    });

    if (!stripe || !elements) {
      const msg = "Payment form is not ready. Please try again.";
      logger.UI.warn("confirm: aborted — Stripe/Elements not ready");
      setError(msg);
      return { success: false, error: msg };
    }

    setLoading(true);
    try {
      logger.UI.log("confirm: calling stripe.confirmSetup");
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });

      if (result.error) {
        const msg =
          result.error.message ||
          "Payment method could not be saved. Please try again.";
        logger.UI.warn("confirm: Stripe returned error", {
          code: result.error.code,
          type: result.error.type,
          declineCode: result.error.decline_code,
          message: result.error.message,
        });
        setError(msg);
        return { success: false, error: msg };
      }

      logger.UI.log("confirm: Stripe confirmSetup succeeded", {
        setupIntentId: result.setupIntent?.id,
        status: result.setupIntent?.status,
      });
      onSuccess?.();
      return { success: true, saved: true };
    } catch (ex) {
      logger.handleError(ex, "PaymentMethodForm.confirm");
      const msg = "An unexpected error occurred. Please try again.";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      submit: confirm,
      async submitOptional() {
        if (paymentEmpty) {
          logger.UI.log("submitOptional: payment element empty — skipping save");
          return { success: true, saved: false };
        }
        return confirm();
      },
    }),
    [stripe, elements, paymentEmpty, logger],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await confirm();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        onReady={() => setReady(true)}
        onChange={(event) => setPaymentEmpty(event.empty)}
        options={{ layout: "accordion" }}
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      )}

      {!hideSubmitButton && (
        <AuthButton
          type="submit"
          className="w-full"
          disabled={!stripe || !elements || loading || !ready}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            submitLabel
          )}
        </AuthButton>
      )}
    </form>
  );
});
