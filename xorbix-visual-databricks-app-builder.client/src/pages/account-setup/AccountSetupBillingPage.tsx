import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Check } from "lucide-react";
import { useIdentity } from "../../context/IdentityContext";
import { billingApi } from "../../providers/BillingApi";
import { PlanCardGrid } from "../../components/PlanCardGrid";
import BetaCodeSection from "../../components/BetaCodeSection";
import PromoCodeInput from "../../components/PromoCodeInput";
import type { BetaCodeValidation } from "../../models";
import { normalizeTier } from "../../hooks/useSubscription";
import {
  PaymentMethodSection,
  type PaymentMethodSectionHandle,
} from "../../components/PaymentMethodSection";
import { SubscriptionProcessingScreen } from "../../components/SubscriptionProcessingScreen";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { toast } from "../../components/ui/use-toast";
import { useLogger } from "../../logger/useLogger";
import { authSpinnerClassName } from "../../constants/authBranding";
import { AuthPageShell } from "../../components/AuthPageShell";
import { useInvalidateAccountSetupStatus } from "../../hooks/useAccountSetupStatus";
import { usePricingTiers } from "../../hooks/usePricingTiers";
import {
  buildTrialMessage,
  formatPlanPriceLabel,
  getTierBySlug,
} from "../../lib/pricing";
import type { BillingInterval } from "../../types/pricing";
import { usePlatformStatus } from "../../hooks/usePlatformStatus";

function getButtonLabel(
  startTrial: boolean,
  hasPaymentMethod: boolean,
  hasSelectedTier: boolean,
  isBetaPath: boolean,
): string {
  if (!hasSelectedTier) return "Select a plan to continue";
  if (isBetaPath) return "Start Beta Trial";
  const action = startTrial ? "Start Free Trial" : "Subscribe";
  return hasPaymentMethod ? action : `Save Payment Method & ${action}`;
}

interface StepIndicatorProps {
  step: number;
  title: string;
  completed: boolean;
  active: boolean;
}

function getStepBadgeClass(completed: boolean, active: boolean): string {
  const base = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full";
  if (completed) return `${base} bg-primary text-primary-foreground`;
  if (active)
    return `${base} border-2 border-primary text-primary font-semibold`;
  return `${base} border-2 border-border text-muted-foreground font-semibold`;
}

function StepIndicator({
  step,
  title,
  completed,
  active,
}: Readonly<StepIndicatorProps>) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={getStepBadgeClass(completed, active)}>
        {completed ? <Check className="h-4 w-4" /> : step}
      </div>
      <h2
        className={
          active || completed
            ? "text-lg font-semibold text-foreground"
            : "text-lg font-semibold text-muted-foreground"
        }
      >
        {title}
      </h2>
    </div>
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AccountSetupBillingPage() {
  const { user, isLoading } = useIdentity();
  const navigate = useNavigate();
  const logger = useLogger("AccountSetupBillingPage");
  const invalidateAccountSetupStatus = useInvalidateAccountSetupStatus();
  const {
    tiers,
    loading: pricingLoading,
    error: pricingError,
  } = usePricingTiers();
  const { data: platformStatus } = usePlatformStatus();

  const step2Ref = useRef<HTMLDivElement>(null);
  const paymentSectionRef = useRef<PaymentMethodSectionHandle>(null);
  const [selectedTier, setSelectedTier] = useState("");

  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [processingClientSecret, setProcessingClientSecret] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  // Trial is opt-out: enabled by default for plans that offer one.
  const [startTrial, setStartTrial] = useState(true);
  // Beta code path: a validated code grants a no-card trial for its tier.
  const [betaCode, setBetaCode] = useState("");
  const [betaValidation, setBetaValidation] =
    useState<BetaCodeValidation | null>(null);

  const handlePromoAppliedChange = useCallback((code: string | null) => {
    setAppliedPromoCode(code);
  }, []);

  // Pre-fill customer billing details from user profile
  useEffect(() => {
    if (user) {
      setInvoiceName(user.fullName);
      setInvoiceEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    setAppliedPromoCode(null);
  }, [selectedTier, billingInterval]);

  const handlePlanSelect = useCallback(
    (slug: string) => {
      setSelectedTier(slug);
      // Selecting a different plan invalidates an applied beta code, which is
      // tied to the tier it grants.
      if (betaValidation && normalizeTier(betaValidation.tier) !== slug) {
        setBetaCode("");
        setBetaValidation(null);
        toast({
          title: "Beta code removed",
          description: `The beta code applies to the ${betaValidation.tier} plan only.`,
        });
      }
      setTimeout(() => {
        step2Ref.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    },
    [betaValidation],
  );

  const handleBetaApplied = useCallback(
    (code: string, validation: BetaCodeValidation) => {
      setBetaCode(code);
      setBetaValidation(validation);
      setAppliedPromoCode(null);
      setSelectedTier(normalizeTier(validation.tier));
      setTimeout(() => {
        step2Ref.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    },
    [],
  );

  const handleBetaCleared = useCallback(() => {
    setBetaCode("");
    setBetaValidation(null);
  }, []);

  const handlePaymentMethodCountChange = useCallback((count: number) => {
    setHasPaymentMethod(count > 0);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  const step1Complete = !!selectedTier;
  const step2Complete =
    invoiceName.trim().length > 0 && isValidEmail(invoiceEmail);
  // Step 3 is considered complete when a payment method is already saved.
  // When no method is saved, the single Subscribe action will save the
  // entered card and create the subscription in one click.
  const step3Complete = hasPaymentMethod;
  const canSubscribe = step1Complete && step2Complete;

  const selectedTierData = getTierBySlug(tiers, selectedTier);
  const selectedTrialDays = selectedTierData?.trialDays ?? null;
  const isBetaPath = betaValidation !== null;
  // A trial is only requested when the chosen plan offers one and the user keeps it enabled.
  const startTrialActive = startTrial && selectedTrialDays !== null;
  const betaTrialEndLabel =
    betaValidation?.trialEndDate?.toLocaleDateString() ?? "";
  const selectedPriceLabel = selectedTierData
    ? formatPlanPriceLabel(selectedTierData, billingInterval)
    : "";
  const trialBilledOnLabel =
    selectedTrialDays === null
      ? ""
      : new Date(
          Date.now() + selectedTrialDays * 24 * 60 * 60 * 1000,
        ).toLocaleDateString();

  async function handleSubscribe() {
    if (!canSubscribe) return;
    logger.UI.log("handleSubscribe: started", {
      tier: selectedTier,
      billingInterval,
      hasPaymentMethod,
      startTrial: startTrialActive,
      isBetaPath,
    });
    setSubscribing(true);
    try {
      // Sync customer billing details to Stripe via backend
      logger.UI.log("handleSubscribe: syncing customer details");
      await billingApi.updateCustomerDetails({
        invoiceName: invoiceName.trim(),
        invoiceEmail: invoiceEmail.trim(),
      });
      logger.UI.log("handleSubscribe: customer details synced");

      // Beta path: card is optional. If entered, save it so the trial resumes
      // when it ends instead of pausing. Non-beta path requires a card when none on file.
      if (isBetaPath) {
        logger.UI.log("handleSubscribe: optional card save via saveIfNeeded");
        const saveResult = await paymentSectionRef.current?.saveIfNeeded({
          optional: true,
        });
        logger.UI.log("handleSubscribe: saveIfNeeded result", {
          success: saveResult?.success,
          hasError: !!saveResult?.error,
        });
        if (saveResult && !saveResult.success) {
          logger.UI.warn(
            "handleSubscribe: aborting because optional card save failed",
            saveResult.error,
          );
          toast({
            title: "Payment method not saved",
            description:
              saveResult.error ?? "Please re-check your card details.",
            variant: "destructive",
          });
          return;
        }
      } else if (!hasPaymentMethod) {
        logger.UI.log("handleSubscribe: saving entered card via saveIfNeeded");
        const saveResult = await paymentSectionRef.current?.saveIfNeeded();
        logger.UI.log("handleSubscribe: saveIfNeeded result", {
          success: saveResult?.success,
          hasError: !!saveResult?.error,
        });
        if (!saveResult?.success) {
          logger.UI.warn(
            "handleSubscribe: aborting because card save failed",
            saveResult?.error,
          );
          toast({
            title: "Payment method required",
            description:
              saveResult?.error ??
              "Please complete your card details before subscribing.",
            variant: "destructive",
          });
          return;
        }
      }

      logger.UI.log(
        isBetaPath
          ? "handleSubscribe: calling createBetaSubscription"
          : "handleSubscribe: calling createSubscription",
      );
      const subscription = isBetaPath
        ? await billingApi.createBetaSubscription({ code: betaCode })
        : await billingApi.createSubscription({
            tier: selectedTier,
            billingInterval,
            startTrial: startTrialActive,
            ...(appliedPromoCode ? { promoCode: appliedPromoCode } : {}),
          });
      logger.UI.log("handleSubscribe: createSubscription returned", {
        hasClientSecret: !!subscription.clientSecret,
        status: subscription.status,
      });

      if (subscription.clientSecret) {
        logger.UI.log(
          "handleSubscribe: client secret present — entering processing screen",
        );
        setProcessingClientSecret(subscription.clientSecret);
      } else {
        logger.UI.log(
          "handleSubscribe: no client secret — invalidating status and navigating to /apps",
        );
        await invalidateAccountSetupStatus(user?.userId, user?.tenantId);
        toast({
          title: isBetaPath ? "Beta trial started" : "Subscription created",
        });
        navigate("/apps", { replace: true });
      }
    } catch (error) {
      logger.handleError(error, "handleSubscribe");
      toast({ title: "Failed to create subscription", variant: "destructive" });
    } finally {
      setSubscribing(false);
    }
  }

  if (processingClientSecret) {
    return (
      <SubscriptionProcessingScreen clientSecret={processingClientSecret} />
    );
  }

  if (isLoading) {
    return (
      <AuthPageShell variant="setup">
        <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
      </AuthPageShell>
    );
  }

  if (!user) return null;

  return (
    <AuthPageShell variant="setup">
      {subscribing && (
        // Overlay (not an early return) so PaymentMethodSection stays mounted
        // and paymentSectionRef.current remains valid while saveIfNeeded runs.
        // Hides the disjointed intermediate states (form save → list → default
        // promotion) behind a single steady "Setting up..." screen.
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm px-4 text-center text-foreground">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <h2 className="text-xl font-semibold">
            Setting up your subscription...
          </h2>
          <p className="text-sm text-muted-foreground">
            {isBetaPath
              ? "Activating your beta trial. This will only take a moment."
              : "Saving your payment method and activating your plan. This will only take a moment."}
          </p>
        </div>
      )}
      <div className="mx-auto w-full max-w-6xl my-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Account Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your plan, enter billing details, and add a payment method.
          </p>
        </div>

        {platformStatus && !platformStatus.paymentsAvailable && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-warning/40 bg-warning-subtle p-4 text-sm text-warning-foreground"
          >
            Payments may be temporarily degraded. You can continue account setup
            and submit your subscription. If payment processing is currently
            unavailable, we'll show an error from the payment provider.
          </div>
        )}

        {/* Stepper */}
        <div className="space-y-8">
          {/* Step 1: Choose Plan */}
          <Card className="mb-24">
            <CardHeader>
              <StepIndicator
                step={1}
                title="Choose Your Plan"
                completed={step1Complete}
                active
              />
            </CardHeader>
            <CardContent>
              {pricingLoading && (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {!pricingLoading && !!pricingError && (
                <p role="alert" className="text-center text-sm text-destructive">
                  We couldn't load plans right now. Please refresh the page and
                  try again.
                </p>
              )}
              {!pricingLoading && !pricingError && (
                <PlanCardGrid
                  tiers={tiers}
                  interval={billingInterval}
                  onIntervalChange={setBillingInterval}
                  selectedTier={selectedTier}
                  onSelect={handlePlanSelect}
                />
              )}
              <BetaCodeSection
                appliedValidation={betaValidation}
                onApplied={handleBetaApplied}
                onCleared={handleBetaCleared}
              />
            </CardContent>
          </Card>

          {/* Step 2: Customer Billing Details */}
          <Card
            ref={step2Ref}
            className={
              step1Complete
                ? "scroll-mt-16"
                : "pointer-events-none opacity-50 scroll-mt-16"
            }
          >
            <CardHeader>
              <StepIndicator
                step={2}
                title="Billing Details"
                completed={step1Complete && step2Complete}
                active={step1Complete}
              />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-1">
                These details appear on every invoice we send you. They are used
                only for billing and can be different from your account name and
                login email.
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Tip: use your company name and a finance/AP email if you want
                invoices routed to your billing team.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="invoiceName">Invoice Name</Label>
                  <Input
                    id="invoiceName"
                    value={invoiceName}
                    onChange={(e) => setInvoiceName(e.target.value)}
                    placeholder="Company or individual name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceEmail">Invoice Email</Label>
                  <Input
                    id="invoiceEmail"
                    type="email"
                    value={invoiceEmail}
                    onChange={(e) => setInvoiceEmail(e.target.value)}
                    placeholder="billing@example.com"
                  />
                </div>
              </div>
              {step1Complete && !isBetaPath && (
                <div className="mt-6">
                  <PromoCodeInput
                    selectedTier={selectedTier}
                    billingInterval={billingInterval}
                    disabled={!step2Complete || subscribing}
                    onAppliedChange={handlePromoAppliedChange}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Payment Method */}
          <Card
            className={
              step1Complete && step2Complete
                ? "mb-24"
                : "pointer-events-none opacity-50 mb-24"
            }
          >
            <CardHeader>
              <StepIndicator
                step={3}
                title={
                  isBetaPath ? "Payment Method (Optional)" : "Payment Method"
                }
                completed={step1Complete && step2Complete && step3Complete}
                active={step1Complete && step2Complete}
              />
            </CardHeader>
            <CardContent>
              {!isBetaPath && selectedTrialDays !== null && (
                <div className="mb-4 rounded-lg border border-border bg-muted p-4">
                  <label className="flex items-start gap-2 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={startTrial}
                      onCheckedChange={(checked) =>
                        setStartTrial(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>Start with a free {selectedTrialDays}-day trial</span>
                  </label>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {startTrial
                      ? buildTrialMessage(
                          selectedTrialDays,
                          selectedPriceLabel,
                          trialBilledOnLabel,
                        )
                      : `You'll be billed ${selectedPriceLabel} today and your subscription starts immediately.`}
                  </p>
                </div>
              )}
              {isBetaPath ? (
                <p className="text-sm text-muted-foreground mb-4">
                  No payment method is required for your beta trial
                  {betaTrialEndLabel ? ` (ends ${betaTrialEndLabel})` : ""}. You
                  can optionally add a card now &mdash; otherwise your account
                  will be paused when the trial ends until you add one. Your
                  data is preserved while paused.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  A payment method is required to{" "}
                  {startTrialActive ? "start your trial" : "subscribe"}.
                  We&apos;ll save your card and{" "}
                  {startTrialActive
                    ? "won't charge it until your trial ends"
                    : "charge it"}{" "}
                  on your next action below &mdash; you only click once.
                </p>
              )}
              <PaymentMethodSection
                ref={paymentSectionRef}
                hideSubmitButton
                onPaymentMethodCountChange={handlePaymentMethodCountChange}
              />
              <Button
                size="lg"
                className="w-full max-w-md mb-4, mt-6"
                disabled={!canSubscribe || subscribing}
                onClick={handleSubscribe}
              >
                {subscribing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  getButtonLabel(
                    startTrialActive,
                    hasPaymentMethod,
                    step1Complete,
                    isBetaPath,
                  )
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthPageShell>
  );
}
