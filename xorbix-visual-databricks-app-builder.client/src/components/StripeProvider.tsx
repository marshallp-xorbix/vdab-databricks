import { useState, useEffect } from "react";
import { type Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { billingApi } from "../providers/BillingApi";
import { getStripePromise } from "../utils/stripeUtils";

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

/**
 * Wraps children with Stripe Elements, initializing Stripe with the publishable key
 * from the backend and the provided SetupIntent client secret.
 */
export function StripeProvider({
  clientSecret,
  children,
}: Readonly<StripeProviderProps>) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function initStripe() {
      try {
        const publishableKey = await billingApi.getPublishableKey();
        const stripeInstance = await getStripePromise(publishableKey);
        if (!isDisposed) {
          setStripe(stripeInstance);
        }
      } catch {
        if (!isDisposed) {
          setError("Failed to initialize payment system. Please try again.");
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    }

    void initStripe();

    return () => {
      isDisposed = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment form...
      </div>
    );
  }

  if (error || !stripe) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground">
        {error || "Payment system unavailable."}
      </div>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#0f172a",
            borderRadius: "6px",
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}
