import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { billingApi } from "../../providers/BillingApi";
import { PaymentMethodSection } from "../../components/PaymentMethodSection";
import { PlanSelector } from "../../components/PlanSelector";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  getDowngradeTiers,
  getTierBySlug,
  getUpgradeTiers,
} from "../../lib/pricing";
import { useInvalidateAccountSetupStatus } from "../../hooks/useAccountSetupStatus";
import { usePricingTiers } from "../../hooks/usePricingTiers";
import { useSubscription } from "../../hooks/useSubscription";
import { toast } from "../../components/ui/use-toast";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";
import { SubscriptionTierSlug } from "../../types/subscriptionTier";
import {
  ACCOUNT_PAGE_CONTAINER_CLASS,
  ACCOUNT_PAGE_SECTION_CLASS,
  ACCOUNT_PAGE_SUBTITLE_CLASS,
  ACCOUNT_PAGE_TITLE_CLASS,
} from "./accountPageStyles.ts";

function AccountBilling() {
  const {
    subscription,
    loading,
    hasStripeCustomer,
    refetch: refetchSubscription,
  } = useSubscription();
  const {
    tiers,
    loading: pricingLoading,
    error: pricingError,
  } = usePricingTiers();
  const [selectedTier, setSelectedTier] = useState("");
  const [changingPlan, setChangingPlan] = useState(false);
  const invalidateAccountSetupStatus = useInvalidateAccountSetupStatus();

  // Adding a card can resume a paused subscription (via Stripe webhook), so
  // refresh the subscription and the setup status that drives the paused banner.
  const handlePaymentMethodSaved = useCallback(() => {
    void refetchSubscription();
    void invalidateAccountSetupStatus();
  }, [refetchSubscription, invalidateAccountSetupStatus]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [downgradeAcknowledged, setDowngradeAcknowledged] = useState(false);
  const [downgrading, setDowngrading] = useState(false);

  // Only show tiers strictly higher than the user's current tier so users
  // can only upgrade (Trial < Individual < Team). Enterprise is excluded.
  const upgradeTiers = useMemo(
    () => getUpgradeTiers(tiers, subscription?.tier),
    [tiers, subscription],
  );

  const individualDowngradeTier = useMemo(
    () =>
      getDowngradeTiers(tiers, subscription?.tier).find(
        (tier) => tier.slug === SubscriptionTierSlug.Individual,
      ),
    [tiers, subscription],
  );

  // Only allow the downgrade when we can positively confirm at most one seat is
  // occupied. A missing seat summary (e.g. a transient backend failure) is
  // treated as "cannot verify" and blocks the action rather than failing open —
  // the backend enforces the same gate, so an optimistic UI would only surface a
  // confusing error toast on confirm.
  const seatSummary = subscription?.seatSummary;
  const occupiedSeats = seatSummary?.occupiedSeats ?? 0;
  const canDowngradeByOccupancy = !!seatSummary && occupiedSeats <= 1;

  useEffect(() => {
    if (!subscription) return;
    // Auto-select when only one upgrade option exists; otherwise reset so the
    // user must explicitly pick a plan before upgrading.
    if (upgradeTiers.length === 1) {
      setSelectedTier(upgradeTiers[0].slug);
    } else {
      setSelectedTier("");
    }
  }, [subscription, upgradeTiers]);

  async function handleChangePlan() {
    if (!selectedTier || selectedTier === subscription?.tier) return;
    setChangingPlan(true);
    try {
      await billingApi.updateSubscription({
        tier: selectedTier,
        // Preserve the subscriber's current interval so a tier change does not
        // silently move an annual plan onto monthly billing.
        billingInterval: subscription?.billingInterval ?? "monthly",
      });
      await refetchSubscription();
      setSelectedTier("");
      toast({ title: "Plan upgraded successfully" });
    } catch (error) {
      toast({
        title: "Failed to upgrade plan",
        description: formatApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setChangingPlan(false);
    }
  }

  async function handleDowngradePlan() {
    if (!individualDowngradeTier || !canDowngradeByOccupancy) return;
    if (!downgradeAcknowledged) return;
    setDowngrading(true);
    try {
      await billingApi.updateSubscription({
        tier: SubscriptionTierSlug.Individual,
        // Preserve the subscriber's current interval so downgrading an annual
        // Team plan does not silently switch them to monthly Individual billing.
        billingInterval: subscription?.billingInterval ?? "monthly",
      });
      await refetchSubscription();
      setDowngradeDialogOpen(false);
      setDowngradeAcknowledged(false);
      toast({ title: "Plan downgraded to Individual" });
    } catch (error) {
      toast({
        title: "Failed to downgrade plan",
        description: formatApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDowngrading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!cancelAcknowledged) return;
    setCancelling(true);
    try {
      await billingApi.cancelSubscription();
      await refetchSubscription();
      setCancelDialogOpen(false);
      setCancelAcknowledged(false);
      toast({
        title: "Subscription will be cancelled at end of billing period",
      });
    } catch (error) {
      toast({
        title: "Failed to cancel subscription",
        description: formatApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  }

  if (loading || pricingLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Manually provisioned tenants have no Stripe billing account; self-service
  // billing management does not apply to them.
  if (!hasStripeCustomer) {
    return (
      <section className={ACCOUNT_PAGE_SECTION_CLASS}>
        <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
          <header>
            <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>Billing & Plan</h1>
            <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
              Manage your subscription and payment methods.
            </p>
          </header>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Billing managed by your administrator</CardTitle>
              <CardDescription>
                Your plan was provisioned directly by an administrator and is not
                linked to a self-service billing account. Self-service plan
                changes, payment methods, and invoices are unavailable. Contact
                your administrator to adjust your plan.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className={ACCOUNT_PAGE_SECTION_CLASS}>
      <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
        <header>
          <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>Billing & Plan</h1>
          <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
            Manage your subscription and payment methods.
          </p>
        </header>

        {/* Payment Methods */}
        <Card className="border-border bg-card mb-16">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>
              Add a new card or remove an existing one. To replace your card,
              add the new one first, then remove the old. Changes take effect on
              your next billing cycle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodSection
              onPaymentMethodSaved={handlePaymentMethodSaved}
            />
          </CardContent>
        </Card>

        {/* Manage Plan */}
        <Card className="border-border bg-card mb-16">
          <CardHeader>
            <CardTitle>
              {subscription ? "Manage Plan" : "Select a Plan"}
            </CardTitle>
            <CardDescription>
              Review your active subscription and change your plan. Plan changes
              are prorated against your current billing period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {subscription && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Current Plan
                </h3>
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-4 py-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                  <div className="text-sm">
                    <span className="font-semibold text-foreground">
                      {getTierBySlug(tiers, subscription.tier)?.name ??
                        subscription.tier}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {subscription.status}
                    </span>
                    {subscription.currentPeriodEnd && (
                      <span className="text-muted-foreground">
                        {" "}
                        · Renews{" "}
                        {new Date(
                          subscription.currentPeriodEnd,
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Upgrade Plan
              </h3>
              {pricingError ? (
                <p role="alert" className="text-xs text-destructive">
                  We couldn't load plan options right now. Please refresh the
                  page to change your plan, or contact sales.
                </p>
              ) : (
                <>
                  {upgradeTiers.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Select a plan below, then click{" "}
                      <strong>Upgrade Plan</strong> to confirm. Your new plan
                      takes effect immediately and is prorated against your
                      current billing period.
                    </p>
                  )}
                  {upgradeTiers.length === 1 && (
                    <p className="text-xs text-muted-foreground">
                      Click <strong>Upgrade Plan</strong> to move to the{" "}
                      {upgradeTiers[0].name} plan. Your new plan takes effect
                      immediately and is prorated against your current billing
                      period.
                    </p>
                  )}
                  {upgradeTiers.length > 0 ? (
                    <PlanSelector
                      selectedTier={selectedTier}
                      onSelect={setSelectedTier}
                      tiers={upgradeTiers}
                      compact
                    />
                  ) : (
                    <div className="rounded-lg border border-border bg-muted p-4">
                      <p className="mt-1 text-xs text-muted-foreground">
                        Need unlimited workspaces, SSO, custom SLAs, or dedicated
                        support? Get in touch about our Enterprise plan.
                      </p>
                      <a
                        href="/contact"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Contact sales about Enterprise
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {individualDowngradeTier && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Downgrade Plan
                </h3>
                {canDowngradeByOccupancy && (
                  <p className="text-xs text-muted-foreground">
                    Move to the {individualDowngradeTier.name} plan. The change
                    takes effect immediately, is prorated against your current
                    billing period, and reduces your account to a single user.
                  </p>
                )}
                {!canDowngradeByOccupancy && seatSummary && (
                  <p role="alert" className="text-xs text-warning-foreground">
                    Downgrade is blocked while more than one seat is occupied.
                    Remove members or free seats first, then try again.{" "}
                    <Link
                      to="/account/seats"
                      className="font-medium text-primary hover:underline"
                    >
                      Manage seats
                    </Link>
                  </p>
                )}
                {!canDowngradeByOccupancy && !seatSummary && (
                  <p role="alert" className="text-xs text-warning-foreground">
                    We couldn't confirm your current seat usage, so downgrade is
                    unavailable right now. Refresh the page and try again, or{" "}
                    <Link
                      to="/account/seats"
                      className="font-medium text-primary hover:underline"
                    >
                      review your seats
                    </Link>
                    .
                  </p>
                )}
                <div className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {individualDowngradeTier.name}
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {individualDowngradeTier.description}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    {individualDowngradeTier.monthlyPrice}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              {subscription && (
                <div className="flex flex-wrap gap-3">
                  {upgradeTiers.length > 0 && (
                    <Button
                      onClick={handleChangePlan}
                      disabled={changingPlan || !selectedTier}
                    >
                      {changingPlan ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Upgrading...
                        </>
                      ) : (
                        "Upgrade Plan"
                      )}
                    </Button>
                  )}
                  {individualDowngradeTier && (
                    <Button
                      variant="outline"
                      onClick={() => setDowngradeDialogOpen(true)}
                      disabled={!canDowngradeByOccupancy || downgrading}
                    >
                      Downgrade to Individual
                    </Button>
                  )}
                  {!subscription.cancelAtPeriodEnd && (
                    <Button
                      variant="destructive"
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <a
                  href="/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View full pricing details
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Downgrade Plan Dialog */}
        <Dialog
          open={downgradeDialogOpen}
          onOpenChange={(open) => {
            setDowngradeDialogOpen(open);
            if (!open) setDowngradeAcknowledged(false);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Downgrade to Individual</DialogTitle>
              <DialogDescription>
                Your plan will become a single-user Individual subscription
                immediately. Extra seats will be removed, and the change is
                prorated against your current billing period.
              </DialogDescription>
            </DialogHeader>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <Checkbox
                checked={downgradeAcknowledged}
                onCheckedChange={(checked) =>
                  setDowngradeAcknowledged(checked === true)
                }
                className="mt-0.5"
              />
              <span>
                I understand this downgrade takes effect immediately, reduces my
                account to one user, and removes extra seats.
              </span>
            </label>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDowngradeDialogOpen(false)}
              >
                Keep Team Plan
              </Button>
              <Button
                onClick={handleDowngradePlan}
                disabled={
                  downgrading ||
                  !downgradeAcknowledged ||
                  !canDowngradeByOccupancy
                }
              >
                {downgrading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downgrading...
                  </>
                ) : (
                  "Confirm Downgrade"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Subscription Dialog */}
        <Dialog
          open={cancelDialogOpen}
          onOpenChange={(open) => {
            setCancelDialogOpen(open);
            if (!open) setCancelAcknowledged(false);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Subscription</DialogTitle>
              <DialogDescription>
                Your subscription will remain active until the end of the
                current billing period. After that, you will lose access to paid
                features.
              </DialogDescription>
            </DialogHeader>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <Checkbox
                checked={cancelAcknowledged}
                onCheckedChange={(checked) =>
                  setCancelAcknowledged(checked === true)
                }
                className="mt-0.5"
              />
              <span>
                I understand my subscription will be cancelled and I will lose
                access to paid features at the end of the current billing
                period.
              </span>
            </label>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
              >
                Keep Subscription
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelSubscription}
                disabled={cancelling || !cancelAcknowledged}
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}

export default AccountBilling;
