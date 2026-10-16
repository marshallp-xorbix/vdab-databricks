import { useState } from "react";
import { Check, X, HelpCircle, Loader2 } from "lucide-react";
import { PlanCardGrid } from "../components/PlanCardGrid";
import { cn } from "../lib/utils";
import { usePricingTiers } from "../hooks/usePricingTiers";
import type { FeatureValue, BillingInterval } from "../types/pricing";

function FeatureCell({ value }: Readonly<{ value: FeatureValue | undefined }>) {
  if (typeof value === "string") {
    return (
      <td className="px-4 py-3 text-center text-sm text-foreground">{value}</td>
    );
  }
  return (
    <td className="px-4 py-3 text-center">
      {value ? (
        <Check className="h-4 w-4 text-success mx-auto" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground mx-auto" />
      )}
    </td>
  );
}

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const { tiers, comparison, faqs, loading, error } = usePricingTiers();

  const showCatalog = !loading && !error && tiers.length > 0;

  return (
    <>
      {/* Hero */}
      <div className="w-full bg-sidebar border-b border-border">
        <div className="max-w-6xl mx-auto px-8 py-14 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            No hidden fees. Pay for what you need and scale when you're ready.
          </p>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="bg-muted border-b border-border">
        <div className="max-w-6xl mx-auto px-8 py-14">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {Boolean(!loading && error) && (
            <p role="alert" className="text-center text-sm text-destructive">
              We couldn't load pricing right now. Please refresh the page or try
              again later.
            </p>
          )}
          {showCatalog && (
            <PlanCardGrid
              tiers={tiers}
              interval={interval}
              onIntervalChange={setInterval}
            />
          )}
        </div>
      </div>

      {/* Feature comparison */}
      {showCatalog && comparison.length > 0 && (
        <div className="bg-card border-b border-border">
          <div className="max-w-6xl mx-auto px-8 py-14">
            <h2 className="text-xl font-bold text-foreground mb-2">
              Compare all plans
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              See exactly what's included across every tier.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-2/5">
                      Feature
                    </th>
                    {tiers.map((tier) => (
                      <th
                        key={tier.slug}
                        className={cn(
                          "px-4 py-3 text-center text-sm font-semibold",
                          tier.highlighted ? "text-primary" : "text-foreground",
                        )}
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={i % 2 === 0 ? "bg-card" : "bg-muted/60"}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-muted-foreground">
                        {row.feature}
                      </td>
                      {tiers.map((tier) => (
                        <FeatureCell
                          key={tier.slug}
                          value={row.values[tier.slug]}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* FAQ */}
      {showCatalog && faqs.length > 0 && (
        <div className="bg-card">
          <div className="max-w-3xl mx-auto px-8 py-14">
            <div className="flex items-center gap-2 mb-8">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">
                Frequently asked questions
              </h2>
            </div>
            <div className="space-y-6">
              {faqs.map(({ q, a }) => (
                <div
                  key={q}
                  className="border-b border-border pb-6 last:border-0"
                >
                  <p className="font-medium text-foreground mb-1.5">{q}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
