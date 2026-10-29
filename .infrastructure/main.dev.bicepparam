using './main.bicep'

// ========================================
// Development Environment Parameters
// ========================================

param environment = 'dev'
param location = 'northcentralus'
param companyPrefix = 'xorbix'
param appPrefix = 'vdab'

// Public URL — dev uses the default App Service hostname (no custom domain).
param frontendUrl = ''

// App Service Plan sizing (dev stays small; no always-on to reduce cost).
param appServicePlanSkuName = 'B1'
param appServicePlanSkuTier = 'Basic'
param appServicePlanCapacity = 1
param appServiceAlwaysOn = false

// Secrets (Postgres connection string, JWT signing key, Stripe keys, Databricks token, GeoLite) are seeded
// Legacy SaaS infrastructure; not part of the standalone Databricks App deployment.

// JWT Configuration
param jwtIssuer = 'https://xorbix-vdab-dev.azurewebsites.net'
param jwtAudience = 'https://xorbix-vdab-dev.azurewebsites.net'
param jwtExpirationMinutes = 60
param jwtRefreshTokenExpirationDays = 7

// Tenant Invite Configuration
param tenantInviteTokenExpirationDays = 7
param tenantInviteMaxBatchSize = 50

// Policy Consent Configuration (ISO yyyy-MM-dd version dates)
param termsOfServiceVersionDate = '2026-03-16'
param privacyPolicyVersionDate = '2026-03-16'

// CORS Configuration
param allowedOrigins = 'http://localhost:5173;https://xorbix-vdab-dev.azurewebsites.net;https://app.vdab.ai'

// Azure Communication Service (Email)
param deployCommunicationService = true
param useCustomEmailDomain = false
param customEmailDomain = 'xorbix.com' // Leave empty to use Azure Managed Domain only. Set to 'yourdomain.com' for custom domain
param emailSenderDisplayName = 'VDAB Notifications'
param emailSenderUsername = 'DoNotReply'

param tags = {
  Environment: 'Development'
  ManagedBy: 'Bicep'
  Project: 'Visual Databricks App Builder'
}

param stripePublishableKey = 'pk_test_51TC0roEJKcCUbZi4i7pwtzVOERvo1ST0XcgrbeYGcawYMVELdCc3FuYXE4bVBc8supFDcYq9C1Gj1ANKCzOjXXpe003eY5er4t'

// Stripe Price IDs (set via pipeline variables or populate directly)
param stripePriceIdIndividualMonthly = 'price_1TgIDlEJKcCUbZi4vPD3gKCq'
param stripePriceIdIndividualYearly = 'price_1TgIESEJKcCUbZi4Lje6wDVQ'
param stripePriceIdTeamMonthly = 'price_1TgIGgEJKcCUbZi41aGoCZvB'
param stripePriceIdTeamYearly = 'price_1TgIH8EJKcCUbZi4f1bq6pTe'
param stripePriceIdEnterpriseMonthly = ''
param stripePriceIdEnterpriseYearly = 'price_1TGURxEJKcCUbZi4Jvv4JPXn'

// Databricks AI Builder — non-secret config (the access token is seeded via secrets.bicep).
param databricksAiWorkspaceUrl = 'https://dbc-bc2a5dd3-798c.cloud.databricks.com/'
param databricksAiEndpointName = 'databricks-claude-sonnet-4-6'
