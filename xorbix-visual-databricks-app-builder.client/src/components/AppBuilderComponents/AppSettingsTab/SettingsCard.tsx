import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

interface ISettingsCardProps {
  /** Optional uppercase section eyebrow. */
  title?: string;
  children: ReactNode;
  className?: string;
  /** Default `section`; use `div` for nested / sidebar cards. */
  as?: "section" | "div";
  /** Padding density — details cards use `md`, metadata rail uses `sm`. */
  padding?: "sm" | "md";
}

/**
 * Shared App Settings surface: themed card with optional uppercase title.
 */
export default function SettingsCard({
  title,
  children,
  className,
  as: Tag = "section",
  padding = "md",
}: Readonly<ISettingsCardProps>) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-[var(--builder-chrome-border)] bg-card shadow-[var(--card-shadow)]",
        padding === "md" ? "p-6" : "p-5",
        className,
      )}
    >
      {title ? (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-widest text-muted-foreground",
            padding === "md" ? "mb-4" : "mb-3",
          )}
        >
          {title}
        </p>
      ) : null}
      {children}
    </Tag>
  );
}
