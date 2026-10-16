import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { AuthButton } from "./AuthButton";
import type { Tier, BillingInterval } from "../types/pricing";

interface Props {
  tier: Tier;
  interval: BillingInterval;
  onSelect?: (slug: string) => void;
  selected?: boolean;
  disabled?: boolean;
}

export function TierCard({
  tier,
  interval,
  onSelect,
  selected,
  disabled,
}: Readonly<Props>) {
  const price = interval === "annual" ? tier.annualPrice : tier.monthlyPrice;
  const priceNote =
    interval === "annual" ? tier.annualPriceNote : tier.monthlyPriceNote;

  const isSelectable = !!onSelect && !disabled;

  function borderClass(): string {
    if (selected) return "border-primary ring-2 ring-primary";
    if (tier.highlighted) return "border-primary ring-2 ring-primary/20";
    return "border-border";
  }

  const card = (
    <div
      className={cn(
        "relative rounded-2xl border bg-card shadow-sm flex flex-col h-full",
        borderClass(),
        disabled && "opacity-60",
      )}
    >
      {tier.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow">
            {tier.badge}
          </span>
        </div>
      )}
      <div className="px-8 pt-8 pb-6 border-b border-border">
        <h2 className="text-lg font-bold text-foreground mb-1">{tier.name}</h2>
        {tier.selfServiceCheckout && (
          <div className="flex items-end gap-1 mb-3">
            <span
              className={
                interval === "annual" && tier.annualBillingNote
                  ? "text-4xl font-extrabold text-foreground mb-5"
                  : "text-4xl font-extrabold text-foreground"
              }
            >
              {price}
            </span>
            {priceNote && interval === "monthly" && (
              <span className="text-sm text-muted-foreground mb-1">{priceNote}</span>
            )}
            {priceNote && interval === "annual" && (
              <span className="text-sm text-muted-foreground mb-1">
                {priceNote}
                <br />
                {tier.annualBillingNote}
              </span>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tier.description}
        </p>
        {tier.trialDays !== null && (
          <p className="mt-3 text-xs font-semibold text-primary">
            {tier.trialDays}-day free trial included
          </p>
        )}
      </div>
      <div className="px-8 py-6 flex-1">
        <ul className="space-y-2.5">
          {tier.highlights.map((h) => (
            <li key={h} className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm text-foreground">{h}</span>
            </li>
          ))}
        </ul>
      </div>
      {!tier.selfServiceCheckout ? (
        <div className="px-8 pb-8">
          <p className="w-full rounded-md border border-border bg-muted px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
            {tier.cta}
          </p>
        </div>
      ) : !onSelect ? (
        <div className="px-8 pb-8">
          <AuthButton
            asChild
            className="w-full"
            variant={tier.highlighted ? "primary" : "outline"}
          >
            <Link
              className={tier.highlighted ? "text-primary-foreground!" : ""}
              to={tier.ctaLink}
            >
              {tier.cta}
            </Link>
          </AuthButton>
        </div>
      ) : disabled && tier.ctaLink ? (
        <div className="px-8 pb-8">
          <AuthButton asChild className="w-full" variant="outline">
            <Link to={tier.ctaLink}>{tier.cta}</Link>
          </AuthButton>
        </div>
      ) : null}
    </div>
  );

  if (isSelectable) {
    return (
      <button
        type="button"
        className="text-left cursor-pointer h-full"
        onClick={() => onSelect(tier.slug)}
      >
        {card}
      </button>
    );
  }

  return card;
}
