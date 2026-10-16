import { useState } from "react";
import { Loader2, Ticket, X } from "lucide-react";
import { betaSignupApi } from "../api/BetaSignupApi";
import { billingApi } from "../providers/BillingApi";
import type { BetaCodeValidation } from "../models";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "./ui/use-toast";
import { useLogger } from "../logger/useLogger";
import { formatApiErrorMessage } from "../utils/apiErrorMessage";

interface IBetaCodeSectionProps {
  /** The currently applied validation, or null when no code is applied. */
  appliedValidation: BetaCodeValidation | null;
  /** Called with the entered code and its validation result after a successful apply. */
  onApplied: (code: string, validation: BetaCodeValidation) => void;
  /** Called when the user removes the applied code. */
  onCleared: () => void;
  /** Use preview API (anonymous) during beta signup; default validates for authenticated tenant. */
  mode?: "authenticated" | "preview";
  /** Tier selected by the user; required for preview validation tier matching. */
  selectedTier?: string;
  /** When true, shows the input immediately instead of a collapsible link. */
  alwaysOpen?: boolean;
}

/**
 * Collapsible "Have a beta code?" entry used during account setup. Validates the
 * code against the API and reports the granted tier/trial back to the parent.
 */
export default function BetaCodeSection({
  appliedValidation,
  onApplied,
  onCleared,
  mode = "authenticated",
  selectedTier,
  alwaysOpen = false,
}: Readonly<IBetaCodeSectionProps>) {
  const logger = useLogger("BetaCodeSection");
  const [open, setOpen] = useState(alwaysOpen);
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);

  async function handleApply() {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    setValidating(true);
    try {
      const validation =
        mode === "preview"
          ? await betaSignupApi.validateBetaCodePreview(trimmedCode, selectedTier)
          : await billingApi.validateBetaCode(trimmedCode);
      logger.UI.log("handleApply: beta code validated", {
        tier: validation.tier,
        mode,
      });
      onApplied(trimmedCode, validation);
    } catch (error) {
      logger.handleError(error, "BetaCodeSection.handleApply");
      toast({
        title: "Beta code not accepted",
        description: formatApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  }

  if (appliedValidation) {
    return (
      <output
        className="mt-6 flex items-start justify-between gap-3 rounded-lg border border-success/40 bg-success-subtle p-4"
      >
        <div className="flex items-start gap-2">
          <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-success-foreground" />
          <div>
            <p className="text-sm font-medium text-success-foreground">
              Beta code applied
            </p>
            <p className="mt-1 text-xs text-success-foreground">
              {appliedValidation.message}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-success-foreground hover:text-success-foreground"
          onClick={() => {
            setCode("");
            onCleared();
          }}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Remove
        </Button>
      </output>
    );
  }

  if (!open && !alwaysOpen) {
    return (
      <div className="mt-6">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={() => setOpen(true)}
        >
          <Ticket className="mr-1.5 h-4 w-4" />
          Have a beta code?
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-lg space-y-2">
      <Label htmlFor="betaCode">Beta code</Label>
      <div className="flex gap-2">
        <Input
          id="betaCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleApply();
            }
          }}
          placeholder="Enter beta code"
          autoComplete="off"
          disabled={validating}
        />
        <Button
          type="button"
          variant="outline"
          disabled={validating || !code.trim()}
          onClick={() => void handleApply()}
        >
          {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A valid beta code starts a free trial with no payment method required.
      </p>
    </div>
  );
}
