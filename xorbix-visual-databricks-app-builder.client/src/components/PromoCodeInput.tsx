import { useEffect, useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { billingApi } from "../providers/BillingApi";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "./ui/use-toast";
import type { PromoCodeValidation } from "../models/PromoCodeValidation";
import { SubscriptionTierSlug } from "../types/subscriptionTier";
import type { BillingInterval } from "../types/pricing";

interface IPromoCodeInputProps {
  selectedTier: string;
  billingInterval: BillingInterval;
  disabled?: boolean;
  onAppliedChange: (appliedCode: string | null) => void;
}

function isPromoEligibleTier(tier: string): boolean {
  return (
    tier === SubscriptionTierSlug.Individual ||
    tier === SubscriptionTierSlug.Team
  );
}

export default function PromoCodeInput({
  selectedTier,
  billingInterval,
  disabled = false,
  onAppliedChange,
}: Readonly<IPromoCodeInputProps>) {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<PromoCodeValidation | null>(
    null,
  );
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCode("");
    setValidation(null);
    setAppliedCode(null);
    setError(null);
    onAppliedChange(null);
  }, [selectedTier, billingInterval, onAppliedChange]);

  const promoVisible =
    isPromoEligibleTier(selectedTier) && billingInterval === "monthly";

  if (!promoVisible) {
    return null;
  }

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) {
      toast({
        title: "Enter a promo code",
        variant: "destructive",
      });
      return;
    }

    setValidating(true);
    setError(null);
    try {
      const result = await billingApi.validatePromoCode({
        code: trimmed,
        tier: selectedTier,
        billingInterval,
      });
      setValidation(result);
      setAppliedCode(trimmed);
      onAppliedChange(trimmed);
      toast({ title: "Promo code applied" });
    } catch {
      setValidation(null);
      setAppliedCode(null);
      onAppliedChange(null);
      setError("This code is not valid for the selected plan.");
      toast({
        title: "Invalid promo code",
        description: "This code is not valid for the selected plan.",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  }

  function handleClear() {
    setCode("");
    setValidation(null);
    setAppliedCode(null);
    setError(null);
    onAppliedChange(null);
  }

  function handleCodeChange(value: string) {
    setCode(value);
    setError(null);
    if (appliedCode && value.trim() !== appliedCode) {
      setValidation(null);
      setAppliedCode(null);
      onAppliedChange(null);
    }
  }

  const discountEndLabel = validation?.discountEndsAt
    ? validation.discountEndsAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  let feedbackId: string | undefined;
  if (validation) {
    feedbackId = "promo-code-success";
  } else if (error) {
    feedbackId = "promo-code-error";
  }

  return (
    <div className="space-y-3 max-w-lg">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Label htmlFor="promoCode">Promo code (optional)</Label>
      </div>
      <div className="flex gap-2">
        <Input
          id="promoCode"
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          placeholder="Enter promo code"
          disabled={disabled || validating}
          aria-describedby={feedbackId}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleApply()}
          disabled={disabled || validating || !code.trim()}
        >
          {validating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="Validating" />
          ) : (
            "Apply"
          )}
        </Button>
        {appliedCode && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={disabled || validating}
          >
            Clear
          </Button>
        )}
      </div>
      {validation && (
        <output id="promo-code-success" className="block text-sm text-success-foreground">
          {validation.message}
          {discountEndLabel
            ? ` Standard pricing starts around ${discountEndLabel}.`
            : ""}
        </output>
      )}
      {error && (
        <p
          id="promo-code-error"
          className="text-sm text-destructive-foreground"
          aria-live="assertive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
