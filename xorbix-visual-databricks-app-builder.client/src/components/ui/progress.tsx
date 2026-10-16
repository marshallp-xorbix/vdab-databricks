import * as React from "react";

import { cn } from "../../lib/utils";

interface IProgressProps extends React.ComponentProps<"div"> {
  value?: number;
  indicatorClassName?: string;
}

function Progress({
  className,
  value = 0,
  indicatorClassName,
  ...props
}: Readonly<IProgressProps>) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full transition-all duration-300 ease-in-out",
          indicatorClassName,
        )}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}

export { Progress };
