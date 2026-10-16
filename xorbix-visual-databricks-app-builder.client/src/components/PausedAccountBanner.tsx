import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

/**
 * Persistent banner shown while the tenant's subscription is paused (a no-card
 * trial ended without a payment method). Links to billing to reactivate.
 */
export default function PausedAccountBanner() {
  return (
    <div
      role="region"
      aria-label="Account paused"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/40 bg-warning-subtle px-4 py-2.5"
    >
      <div className="flex items-center gap-2 text-sm text-warning-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Your trial has ended and your account is paused. Add a payment method
          to reactivate your account. Your data is preserved.
        </span>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link to="/account/billing">Add payment method</Link>
      </Button>
    </div>
  );
}
