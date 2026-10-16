import { Loader2 } from "lucide-react";
import { PlanCardGrid } from "../PlanCardGrid";
import { AuthButton } from "../AuthButton";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { usePricingTiers } from "../../hooks/usePricingTiers";
import { betaSignupApi } from "../../api/BetaSignupApi";
import type { BetaCodeValidation } from "../../models";
import { useLogger } from "../../logger/useLogger";
import { authSpinnerClassName } from "../../constants/authBranding";
import type { BillingInterval } from "../../types/pricing";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";

interface IBetaSignupPlanAndCodeStepProps {
  interval: BillingInterval;
  selectedTier: string;
  betaCode: string;
  error: string | null;
  validating: boolean;
  onIntervalChange: (interval: BillingInterval) => void;
  onSelect: (slug: string) => void;
  onBetaCodeChange: (code: string) => void;
  onError: (message: string | null) => void;
  onValidatingChange: (validating: boolean) => void;
  onValidated: (code: string, validation: BetaCodeValidation) => void;
}

export default function BetaSignupPlanAndCodeStep({
  interval,
  selectedTier,
  betaCode,
  error,
  validating,
  onIntervalChange,
  onSelect,
  onBetaCodeChange,
  onError,
  onValidatingChange,
  onValidated,
}: Readonly<IBetaSignupPlanAndCodeStepProps>) {
  const logger = useLogger("BetaSignupPlanAndCodeStep");
  const { tiers, loading, error: tiersError } = usePricingTiers();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    onError(null);

    const trimmedCode = betaCode.trim();
    if (!selectedTier) {
      onError("Select a plan to continue.");
      return;
    }
    if (!trimmedCode) {
      onError("Enter your beta code to continue.");
      return;
    }

    onValidatingChange(true);
    try {
      const validation = await betaSignupApi.validateBetaCodePreview(
        trimmedCode,
        selectedTier,
      );
      logger.UI.log("handleSubmit: beta code validated", {
        tier: validation.tier,
      });
      onValidated(trimmedCode, validation);
    } catch (submitError: unknown) {
      logger.handleError(submitError, "BetaSignupPlanAndCodeStep.handleSubmit");
      onError(formatApiErrorMessage(submitError));
    } finally {
      onValidatingChange(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className={`h-8 w-8 animate-spin ${authSpinnerClassName}`} />
      </div>
    );
  }

  if (tiersError || tiers.length === 0) {
    return (
      <p className="text-sm text-destructive">
        Unable to load plans. Please refresh and try again.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      )}

      <PlanCardGrid
        tiers={tiers}
        interval={interval}
        onIntervalChange={onIntervalChange}
        selectedTier={selectedTier}
        onSelect={onSelect}
      />

      <div className="max-w-lg space-y-2">
        <Label htmlFor="betaCode">Beta code</Label>
        <div className="flex gap-2">
          <Input
            id="betaCode"
            value={betaCode}
            onChange={(e) => onBetaCodeChange(e.target.value)}
            placeholder="Enter beta code"
            autoComplete="off"
            disabled={validating}
            className="min-w-0 flex-1"
          />
          <AuthButton
            type="submit"
            className="shrink-0"
            disabled={validating || !selectedTier || !betaCode.trim()}
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Continue"
            )}
          </AuthButton>
        </div>
        <p className="text-xs text-muted-foreground">
          Your beta code must match the plan you selected.
        </p>
      </div>
    </form>
  );
}
