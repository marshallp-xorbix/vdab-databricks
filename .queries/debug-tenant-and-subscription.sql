-- Add more patterns here as needed (example: '%admin%').
-- Update the array below once, then run the rest of the queries.

CREATE TEMP TABLE IF NOT EXISTS debug_user_name_patterns (
    pattern text NOT NULL
);

TRUNCATE TABLE debug_user_name_patterns;

INSERT INTO debug_user_name_patterns (pattern)
SELECT unnest(ARRAY['%test%']::text[]);

WITH user_lookup AS (
    SELECT DISTINCT u."Id" AS "UserId"
    FROM iam."Users" u
    JOIN debug_user_name_patterns p ON u."UserName" LIKE p.pattern
)
SELECT 'iam.Users' AS "Table", *
FROM iam."Users"
WHERE "Id" IN (SELECT "UserId" FROM user_lookup);

WITH user_lookup AS (
    SELECT DISTINCT u."Id" AS "UserId"
    FROM iam."Users" u
    JOIN debug_user_name_patterns p ON u."UserName" LIKE p.pattern
)
SELECT 'iam.UserRoles' AS "Table", u."UserName", ur.*, r."Name"
FROM iam."UserRoles" ur
LEFT JOIN iam."Roles" r ON r."Id" = ur."RoleId"
LEFT JOIN iam."Users" u ON u."Id" = ur."UserId"
WHERE ur."UserId" IN (SELECT "UserId" FROM user_lookup);

WITH user_lookup AS (
    SELECT DISTINCT u."Id" AS "UserId"
    FROM iam."Users" u
    JOIN debug_user_name_patterns p ON u."UserName" LIKE p.pattern
),
tenant_list AS (
    SELECT DISTINCT utm."TenantId"
    FROM iam."UserTenantMemberships" utm
    WHERE utm."UserId" IN (SELECT "UserId" FROM user_lookup)
)
SELECT 'dbo.Tenants' AS "Table", "BillingCustomerId", *
FROM dbo."Tenants"
WHERE "TenantId" IN (SELECT "TenantId" FROM tenant_list);

WITH user_lookup AS (
    SELECT DISTINCT u."Id" AS "UserId"
    FROM iam."Users" u
    JOIN debug_user_name_patterns p ON u."UserName" LIKE p.pattern
)
SELECT 'iam.UserTenantMemberships' AS "Table", u."UserName", t."DisplayName", tm.*
FROM iam."UserTenantMemberships" tm
LEFT JOIN iam."Users" u ON u."Id" = tm."UserId"
LEFT JOIN dbo."Tenants" t ON t."TenantId" = tm."TenantId"
WHERE tm."UserId" IN (SELECT "UserId" FROM user_lookup);

WITH user_lookup AS (
    SELECT DISTINCT u."Id" AS "UserId"
    FROM iam."Users" u
    JOIN debug_user_name_patterns p ON u."UserName" LIKE p.pattern
),
tenant_list AS (
    SELECT DISTINCT utm."TenantId"
    FROM iam."UserTenantMemberships" utm
    WHERE utm."UserId" IN (SELECT "UserId" FROM user_lookup)
)
SELECT 'dbo.SubscriptionSeats' AS "Table", u."UserName", t."DisplayName", ss.*
FROM dbo."SubscriptionSeats" ss
LEFT JOIN iam."Users" u ON u."Id" = ss."UserId"
LEFT JOIN dbo."Tenants" t ON t."TenantId" = ss."TenantId"
WHERE ss."TenantId" IN (SELECT "TenantId" FROM tenant_list);

WITH user_lookup AS (
    SELECT DISTINCT u."Id" AS "UserId"
    FROM iam."Users" u
    JOIN debug_user_name_patterns p ON u."UserName" LIKE p.pattern
),
tenant_list AS (
    SELECT DISTINCT utm."TenantId"
    FROM iam."UserTenantMemberships" utm
    WHERE utm."UserId" IN (SELECT "UserId" FROM user_lookup)
)
SELECT 'dbo.TenantInvites' AS "Table", t."DisplayName", ss.*
FROM dbo."TenantInvites" ss
LEFT JOIN dbo."Tenants" t ON t."TenantId" = ss."TenantId"
WHERE ss."TenantId" IN (SELECT "TenantId" FROM tenant_list);

WITH user_lookup AS (
    SELECT DISTINCT u."Id" AS "UserId"
    FROM iam."Users" u
    JOIN debug_user_name_patterns p ON u."UserName" LIKE p.pattern
),
tenant_list AS (
    SELECT DISTINCT utm."TenantId"
    FROM iam."UserTenantMemberships" utm
    WHERE utm."UserId" IN (SELECT "UserId" FROM user_lookup)
)
SELECT 'dbo.SubscriptionHistory' AS "Table", t."DisplayName", sh.*
FROM dbo."SubscriptionHistory" sh
LEFT JOIN dbo."Tenants" t ON t."TenantId" = sh."TenantId"
WHERE sh."TenantId" IN (SELECT "TenantId" FROM tenant_list)
ORDER BY sh."CreatedOn" ASC;

SELECT 'dbo.StripeEventLogs' AS "Table", "CustomerId", "DetailSummary", *
FROM dbo."StripeEventLogs";