
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import { cn } from "../../lib/utils";

const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
        ref={ref}
        data-slot="checkbox"
        className={cn(
            // Base styles
            "peer size-4 shrink-0 rounded-[4px] border border-input transition-shadow " +
            "outline-none shadow-xs disabled:cursor-not-allowed disabled:opacity-50",

            "focus-visible:ring-[3px] focus-visible:ring-primary/40 focus-visible:border-primary",

            "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",

            className
        )}
        style={{ borderWidth: 1, borderStyle: "solid" }}
        {...props}
    >
        <CheckboxPrimitive.Indicator
            data-slot="checkbox-indicator"
            className="grid place-content-center text-current transition-none"
        >
            <CheckIcon className="w-3 h-3" />
        </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };