import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const chipVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary hover:bg-primary/25",
        success:
          "bg-success-subtle text-success-foreground border border-success/30 hover:bg-success/20",
        warning:
          "bg-warning-subtle text-warning-foreground border border-warning/30 hover:bg-warning/20",
        destructive:
          "bg-destructive-subtle text-destructive-foreground border border-destructive/30 hover:bg-destructive/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "text-foreground border border-input",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ChipProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

function Chip({ className, variant, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ variant }), className)} {...props} />
  );
}

export { Chip, chipVariants };
