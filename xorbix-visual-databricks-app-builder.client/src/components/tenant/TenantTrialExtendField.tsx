import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface ITenantTrialExtendFieldProps {
  trialEndDate?: string | Date;
  subscriptionStatus?: string;
  /** True when the current user may extend an active trial. */
  canExtend: boolean;
  extending: boolean;
  onExtend: (newTrialEndDate: Date) => Promise<void>;
}

const formatDate = (value: string | Date | undefined): string => {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString();
};

const toDateInputValue = (date: Date): string =>
  date.toISOString().slice(0, 10);

/**
 * Displays a tenant's trial end date and, for permitted users, an inline control to
 * extend an active trial to a chosen date. Renders nothing when there is no trial to show.
 */
const TenantTrialExtendField = ({
  trialEndDate,
  subscriptionStatus,
  canExtend,
  extending,
  onExtend,
}: Readonly<ITenantTrialExtendFieldProps>) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const isTrialing = (subscriptionStatus ?? "").toLowerCase() === "trialing";
  const showExtend = canExtend && isTrialing;

  if (!trialEndDate && !showExtend) {
    return null;
  }

  const openEditor = () => {
    const base = trialEndDate ? new Date(trialEndDate) : new Date();
    base.setDate(base.getDate() + 7);
    setValue(toDateInputValue(base));
    setOpen(true);
  };

  const confirm = async () => {
    if (!value) return;
    // Interpret the date input as end-of-day UTC so the trial covers the whole day.
    await onExtend(new Date(`${value}T23:59:59Z`));
    setOpen(false);
  };

  return (
    <div className="md:col-span-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm text-muted-foreground">Trial End Date</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs px-3 py-2 text-xs">
            When the trial period ends. Global administrators can extend an
            active trial.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <p className="text-sm text-foreground">{formatDate(trialEndDate)}</p>
        {showExtend && !open && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openEditor}
            disabled={extending}
          >
            Extend trial
          </Button>
        )}
      </div>

      {showExtend && open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={value}
            min={toDateInputValue(new Date())}
            onChange={(event) => setValue(event.target.value)}
            className="w-44"
            disabled={extending}
          />
          <Button
            type="button"
            size="sm"
            onClick={confirm}
            disabled={extending || !value}
          >
            {extending ? "Extending…" : "Confirm"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={extending}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

export default TenantTrialExtendField;
