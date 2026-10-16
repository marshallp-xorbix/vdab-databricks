import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { billingApi } from "../providers/BillingApi";
import { getStripePromise } from "../utils/stripeUtils";
import { Button } from "./ui/button";
import { useLogger } from "../logger/useLogger";
import { toast } from "./ui/use-toast";
import { useInvalidateAccountSetupStatus } from "../hooks/useAccountSetupStatus";
import { authSpinnerClassName } from "../constants/authBranding";
import { AuthPageShell } from "./AuthPageShell";

type ProcessingPhase = "confirming" | "activating" | "complete" | "error";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

interface Props {
  clientSecret: string;
}

export function SubscriptionProcessingScreen({
  clientSecret,
}: Readonly<Props>) {
  const navigate = useNavigate();
  const logger = useLogger("SubscriptionProcessingScreen");
  const invalidateAccountSetupStatus = useInvalidateAccountSetupStatus();

  const [phase, setPhase] = useState<ProcessingPhase>("confirming");
  const [errorMessage, setErrorMessage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);
  const confirmedRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    async function confirmAndPoll() {
      try {
        const publishableKey = await billingApi.getPublishableKey();
        const stripe = await getStripePromise(publishableKey);

        if (!stripe || disposed) return;

        const { error } = await stripe.confirmCardPayment(clientSecret);

        if (disposed) return;

        if (error) {
          logger.handleError(error, "confirmCardPayment");
          setPhase("error");
          setErrorMessage(
            error.message ||
              "Payment could not be completed. Please try again.",
          );
          return;
        }

        confirmedRef.current = true;
        setPhase("activating");
        startPolling(disposed);
      } catch (err) {
        if (disposed) return;
        logger.handleError(err, "confirmAndPoll");
        setPhase("error");
        setErrorMessage(
          "An unexpected error occurred while processing payment.",
        );
      }
    }

    async function pollOnce(isDisposed: boolean) {
      if (isDisposed) {
        clearPolling();
        return;
      }

      attemptRef.current += 1;

      if (attemptRef.current > MAX_POLL_ATTEMPTS) {
        clearPolling();
        setPhase("error");
        setErrorMessage(
          "Subscription activation is taking longer than expected. Please check your account page.",
        );
        return;
      }

      try {
        const subscription = await billingApi.getSubscription();
        const isActive =
          subscription.status === "active" ||
          subscription.status === "trialing";
        if (isActive) {
          clearPolling();
          await invalidateAccountSetupStatus();
          setPhase("complete");
          toast({ title: "Subscription activated!" });
          setTimeout(() => {
            if (!isDisposed) navigate("/apps", { replace: true });
          }, 1500);
        }
      } catch {
        // Polling failures are transient — keep retrying
      }
    }

    function startPolling(isDisposed: boolean) {
      pollRef.current = setInterval(
        () => void pollOnce(isDisposed),
        POLL_INTERVAL_MS,
      );
    }

    void confirmAndPoll();

    return () => {
      disposed = true;
      clearPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret]);

  function clearPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function handleGoHome() {
    clearPolling();
    navigate("/apps", { replace: true });
  }

  return (
    <AuthPageShell variant="setup">
      <div className="flex flex-col items-center justify-center gap-6 px-4">
        <PhaseDisplay phase={phase} errorMessage={errorMessage} />

        <Button variant="outline" size="lg" onClick={handleGoHome}>
          Go to Home
        </Button>
      </div>
    </AuthPageShell>
  );
}

interface PhaseDisplayProps {
  phase: ProcessingPhase;
  errorMessage: string;
}

function PhaseDisplay({ phase, errorMessage }: Readonly<PhaseDisplayProps>) {
  switch (phase) {
    case "confirming":
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
          <h2 className="text-xl font-semibold">Processing your payment...</h2>
          <p className="text-sm text-muted-foreground">
            Please wait while we confirm your payment method.
          </p>
        </div>
      );
    case "activating":
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
          <h2 className="text-xl font-semibold">
            Activating your subscription...
          </h2>
          <p className="text-sm text-muted-foreground">
            Payment confirmed. Setting up your account.
          </p>
        </div>
      );
    case "complete":
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h2 className="text-xl font-semibold">Subscription activated!</h2>
          <p className="text-sm text-muted-foreground">
            Redirecting you to your dashboard...
          </p>
        </div>
      );
    case "error":
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      );
  }
}
