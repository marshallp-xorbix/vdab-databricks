import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import type React from "react";

const authButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold h-9 px-5 py-2 transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
        outline:
          "border border-border bg-transparent text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

interface AuthButtonProps
  extends
    React.ComponentProps<"button">,
    VariantProps<typeof authButtonVariants> {
  asChild?: boolean;
}

export function AuthButton({
  className,
  variant,
  asChild = false,
  type = "button",
  ...props
}: Readonly<AuthButtonProps>) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(authButtonVariants({ variant }), className)}
      {...props}
    />
  );
}
