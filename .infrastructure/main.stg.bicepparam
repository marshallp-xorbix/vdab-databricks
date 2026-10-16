using './main.bicep'

// ========================================
// Staging Environment Parameters
// Azure App Service: xorbix-vdab-stg   |   Key Vault: xorbixvdabstgkv
// Public URL: https://xorbix-vdab-stg.azurewebsites.net  |   Lakebase branch: stg
// ========================================

param environment = 'stg'
param location = 'northcentralus'
param companyPrefix = 'xorbix'
param appPrefix = 'vdab'

// Canonical public URL (custom domain bound to xorbix-vdab-stg, e.g., https://xorbix-vdab-stg.azurewebsites.net). Used for email links.
param frontendUrl = ''

// App Service Plan sizing — staging mirrors production behavior (always on) on a small SKU.
param appServicePlanSkuName = 'B1'
param appServicePlanSkuTier = 'Basic'
param appServicePlanCapacity = 1
param appServiceAlwaysOn = true

// JWT Configuration
param jwtIssuer = 'https://xorbix-vdab-stg.azurewebsites.net'
param jwtAudience = 'https://xorbix-vdab-stg.azurewebsites.net'
param jwtExpirationMinutes = 60
param jwtRefreshTokenExpirationDays = 7

// Tenant Invite Configuration
param tenantInviteTokenExpirationDays = 7
param tenantInviteMaxBatchSize = 50

// Policy Consent Configuration (ISO yyyy-MM-dd version dates)
param termsOfServiceVersionDate = '2026-03-16'
param privacyPolicyVersionDate = '2026-03-16'

// CORS — allow the custom domain, the default App Service host, and local dev.
param allowedOrigins = 'http://localhost:5173;https://localhost:5173;https://xorbix-vdab-stg.azurewebsites.net'

// Secrets (JWT signing key, Postgres connection string, Stripe keys, Databricks token, GeoLite) are seeded
// out-of-band via secrets.bicep and are NOT set in this file — see .documentation/deployment/4-deploy-bicep.md.

// Azure Communication Service (Email) — managed domain only for staging.
param deployCommunicationService = true
param useCustomEmailDomain = false
param customEmailDomain = 'xorbix.com'
param emailSenderDisplayName = 'VDAB Notifications'
param emailSenderUsername = 'DoNotReply'

param tags = {
  Environment: 'Staging'
  ManagedBy: 'Bicep'
  Project: 'Visual Databricks App Builder'
}

// Stripe — staging uses TEST-mode keys/prices.
param stripePublishableKey = 'pk_test_51Tj5IxCnAhPONhuweFaKm137y524yDBzuZ7gk0Io59BOGxud8NxpP76X4CEc6E24qJPzcQuMDXcarrRmjLQJasgT00Hy7kqWFU'
param stripePriceIdIndividualMonthly = 'price_1Tj5JyCnAhPONhuwzgiZuiXK'
param stripePriceIdIndividualYearly = 'price_1Tj5KECnAhPONhuws6SJoyMv'
param stripePriceIdTeamMonthly = 'price_1Tj5LDCnAhPONhuwbh2nXqd8'
param stripePriceIdTeamYearly = 'price_1Tj5LQCnAhPONhuwmBLM2PbA'
param stripePriceIdEnterpriseMonthly = ''
param stripePriceIdEnterpriseYearly = 'price_1Tj5MjCnAhPONhuwTSUDh7rP'

// Databricks AI Builder — non-secret config (the access token is seeded via secrets.bicep).
param databricksAiWorkspaceUrl = 'https://dbc-bc2a5dd3-798c.cloud.databricks.com/'
param databricksAiEndpointName = 'databricks-claude-sonnet-4-6'
