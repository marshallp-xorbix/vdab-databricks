import { ArrowRight, ExternalLink } from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";

interface NavigationTileProps {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  to?: string;
  href?: string;
  disabled?: boolean;
  disabledLabel?: string;
  layout?: "vertical" | "horizontal";
  iconSizeClassName?: string;
  className?: string;
}

export function NavigationTile({
  title,
  description,
  icon: Icon,
  iconClassName,
  to,
  href,
  disabled = false,
  disabledLabel = "Soon",
  layout = "vertical",
  iconSizeClassName,
  className,
}: Readonly<NavigationTileProps>) {
  const canNavigate = Boolean(to || href) && !disabled;
  const iconSizeClass =
    iconSizeClassName ?? (layout === "horizontal" ? "h-4 w-4" : "h-6 w-6");
  const TrailingIcon = href ? ExternalLink : ArrowRight;

  const baseClassName =
    "group rounded-xl border bg-card text-left shadow-sm transition-all duration-200";
  const spacingClassName = layout === "horizontal" ? "p-5" : "p-6";

  let stateClassName = "border-border hover:border-primary/35 hover:shadow-md";

  if (disabled) {
    stateClassName = "cursor-not-allowed border-border opacity-70";
  } else if (canNavigate) {
    stateClassName =
      "block cursor-pointer border-border hover:border-primary/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  }

  const iconContainerClassName = cn(
    "rounded-lg",
    layout === "horizontal"
      ? "flex h-9 w-9 shrink-0 items-center justify-center"
      : "p-3",
    iconClassName,
  );

  const content =
    layout === "horizontal" ? (
      <div className="flex items-start gap-4">
        <div className={iconContainerClassName}>
          <Icon className={iconSizeClass} />
        </div>
        <div className="flex-1">
          <h3 className="mb-0.5 text-sm font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {disabled && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {disabledLabel}
          </span>
        )}
        {!disabled && canNavigate && (
          <TrailingIcon className="mt-0.5 h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
        )}
      </div>
    ) : (
      <>
        <div className="mb-4 flex items-start justify-between">
          <div className={iconContainerClassName}>
            <Icon className={iconSizeClass} />
          </div>
          {disabled && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {disabledLabel}
            </span>
          )}
          {!disabled && canNavigate && (
            <TrailingIcon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </>
    );

  if (disabled || (!to && !href)) {
    return (
      <div
        aria-disabled={disabled || undefined}
        className={cn(
          baseClassName,
          spacingClassName,
          stateClassName,
          className,
        )}
      >
        {content}
      </div>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          baseClassName,
          spacingClassName,
          stateClassName,
          className,
        )}
      >
        {content}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        className={cn(baseClassName, spacingClassName, stateClassName, className)}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(baseClassName, spacingClassName, stateClassName, className)}
    >
      {content}
    </div>
  );
}
