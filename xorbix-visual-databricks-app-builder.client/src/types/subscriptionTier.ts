/**
 * Canonical subscription tier slugs.
 * These values are sent to the backend API and must match the backend
 * `SubscriptionTier` enum names (case-insensitive on the server).
 *
 * Trial      – Free 14-day evaluation period
 * Individual – Single-user paid plan
 * Team       – Multi-seat collaborative plan
 * Enterprise – Custom, contact-sales only
 */
export enum SubscriptionTierSlug {
  Trial = "trial",
  Individual = "individual",
  Team = "team",
  Enterprise = "enterprise",
}
