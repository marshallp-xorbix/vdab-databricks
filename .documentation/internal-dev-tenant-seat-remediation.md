# Internal Dev Tenant Seat Remediation (Production)

One-time production data fix for the Demo and Xorbix internal/dev tenants so existing members appear on Seats & Users and limits stay unlimited. Run **after** deploying the complimentary seat-management code that reads `InternalDevTenants:TenantIds`.

## Config (do not commit tenant IDs)

Committed `appsettings.json` / `appsettings.Development.json` keep an empty allowlist. Set real IDs only via:

| Environment | Where |
| --- | --- |
| Local | gitignored `appsettings.Local.json` (see `appsettings.Local.example.json`) |
| Azure | App Settings / env vars: `InternalDevTenants__TenantIds__0`, `InternalDevTenants__TenantIds__1` |

Resolve the Demo and Xorbix tenant IDs from your environment (Azure portal, admin UI, or DB) before running SQL. Do **not** paste production IDs into committed files.

## Steps

1. Confirm the deployed environment has both IDs under `InternalDevTenants:TenantIds` (Azure App Settings or equivalent overlay — not committed appsettings).
2. Substitute the placeholders below with those IDs, then run the SQL against the production PostgreSQL database (review in a transaction first).
3. Sign in as a tenant admin on each tenant and open `/account/seats`.
4. Invite a test address, accept it, and confirm a new seat row appears without Stripe errors.

## SQL

```sql
BEGIN;

-- Unlimited limits for both internal/dev tenants
UPDATE dbo."Tenants"
SET
    "MaxUsers" = 0,
    "MaxPublishedApps" = 0,
    "MaxWorkspaceConnections" = 0,
    "SubscriptionStatus" = 'active'
WHERE "TenantId" IN (
    '<XORBIX_TENANT_ID>',
    '<DEMO_TENANT_ID>'
);

-- Backfill one Active seat per current membership that has no seat yet
INSERT INTO dbo."SubscriptionSeats" (
    "SubscriptionSeatId",
    "TenantId",
    "UserId",
    "Status",
    "IsBundled",
    "SeatStartDate",
    "AssignedAt",
    "CreatedOn",
    "CreatedBy"
)
SELECT
    gen_random_uuid(),
    m."TenantId",
    m."UserId",
    'Active',
    TRUE,
    NOW(),
    NOW(),
    NOW(),
    m."UserId"
FROM iam."UserTenantMemberships" m
WHERE m."TenantId" IN (
    '<XORBIX_TENANT_ID>',
    '<DEMO_TENANT_ID>'
)
  AND m."DeletedOn" IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM dbo."SubscriptionSeats" s
      WHERE s."TenantId" = m."TenantId"
        AND s."UserId" = m."UserId"
        AND s."Status" <> 'Canceled'
  );

COMMIT;
```

## Verification queries

```sql
SELECT "TenantId", "TenantName", "SubscriptionTier", "MaxUsers", "MaxPublishedApps", "MaxWorkspaceConnections", "SubscriptionStatus"
FROM dbo."Tenants"
WHERE "TenantId" IN (
    '<XORBIX_TENANT_ID>',
    '<DEMO_TENANT_ID>'
);

SELECT s."TenantId", COUNT(*) AS seat_count, COUNT(s."UserId") AS occupied
FROM dbo."SubscriptionSeats" s
WHERE s."TenantId" IN (
    '<XORBIX_TENANT_ID>',
    '<DEMO_TENANT_ID>'
)
  AND s."Status" <> 'Canceled'
GROUP BY s."TenantId";
```
