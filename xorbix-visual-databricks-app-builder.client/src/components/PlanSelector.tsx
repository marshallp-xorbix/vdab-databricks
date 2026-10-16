import { Check } from "lucide-react";
import { cn } from "../lib/utils";
import type { Tier } from "../types/pricing";

interface PlanCardProps {
  tier: Tier;
  selected: boolean;
  onSelect: (slug: string) => void;
  compact?: boolean;
}

function PlanCard({
  tier,
  selected,
  onSelect,
  compact = false,
}: Readonly<PlanCardProps>) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onSelect(tier.slug)}
        className={cn(
          "relative flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-all hover:shadow-sm",
          selected
            ? "border-primary ring-2 ring-primary/20"
            : "border-border hover:border-primary/40",
        )}
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">{tier.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{tier.description}</p>
        </div>
        <div className="ml-4 flex items-end gap-1 whitespace-nowrap">
          <span className="text-lg font-bold text-foreground">
            {tier.monthlyPrice}
          </span>
          {tier.monthlyPriceNote && (
            <span className="mb-0.5 text-[11px] text-muted-foreground">
              {tier.monthlyPriceNote}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(tier.slug)}
      className={cn(
        "relative w-full rounded-xl border bg-card p-5 text-left transition-all hover:shadow-md",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40",
      )}
    >
      {tier.badge && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          {tier.badge}
        </span>
      )}

      <div className="mb-3">
        <h3 className="text-base font-bold text-foreground">{tier.name}</h3>
        <div className="mt-1 flex items-end gap-1">
          <span className="text-2xl font-extrabold text-foreground">
            {tier.monthlyPrice}
          </span>
          {tier.monthlyPriceNote && (
            <span className="mb-0.5 text-xs text-muted-foreground">
              {tier.monthlyPriceNote}
            </span>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        {tier.description}
      </p>

      <ul className="space-y-1.5">
        {tier.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span className="text-xs text-foreground">{h}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

interface PlanSelectorProps {
  selectedTier: string;
  onSelect: (slug: string) => void;
  tiers: Tier[];
  compact?: boolean;
}

export function PlanSelector({
  selectedTier,
  onSelect,
  tiers,
  compact = false,
}: Readonly<PlanSelectorProps>) {
  return (
    <div className="grid gap-3">
      {tiers.map((tier) => (
        <PlanCard
          key={tier.slug}
          tier={tier}
          selected={selectedTier === tier.slug}
          onSelect={onSelect}
          compact={compact}
        />
      ))}
    </div>
  );
}
