import { TierCard } from "./TierCard";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import type { BillingInterval, Tier } from "../types/pricing";

interface Props {
  tiers: Tier[];
  interval: BillingInterval;
  onIntervalChange: (interval: BillingInterval) => void;
  selectedTier?: string;
  onSelect?: (slug: string) => void;
}

export function PlanCardGrid({
  tiers,
  interval,
  onIntervalChange,
  selectedTier,
  onSelect,
}: Readonly<Props>) {
  return (
    <div>
      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <Tabs
          value={interval}
          onValueChange={(v) => onIntervalChange(v as BillingInterval)}
        >
          <TabsList className="bg-muted rounded-full p-1">
            <TabsTrigger
              value="monthly"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground hover:text-foreground rounded-full px-5 py-1.5 text-sm font-medium"
            >
              Monthly
            </TabsTrigger>
            <TabsTrigger
              value="annual"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground hover:text-foreground rounded-full px-5 py-1.5 text-sm font-medium"
            >
              Annual
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => (
          <TierCard
            key={tier.slug}
            tier={tier}
            interval={interval}
            onSelect={onSelect}
            selected={selectedTier === tier.slug}
            disabled={onSelect ? !tier.selfServiceCheckout : undefined}
          />
        ))}
      </div>
    </div>
  );
}
