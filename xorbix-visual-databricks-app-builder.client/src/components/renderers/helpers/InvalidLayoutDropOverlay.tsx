import type { FC } from "react";
import { cn } from "../../../lib/utils";

interface InvalidLayoutDropOverlayProps {
  className?: string;
}

export const InvalidLayoutDropOverlay: FC<InvalidLayoutDropOverlayProps> = ({
  className,
}) => (
  <div
    className={cn(
      "pointer-events-none absolute inset-0 z-[2]",
      "bg-[repeating-linear-gradient(135deg,transparent_0px,transparent_7px,rgba(239,68,68,0.11)_7px,rgba(239,68,68,0.11)_14px)]",
      className,
    )}
    aria-hidden
  />
);
