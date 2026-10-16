using './main.bicep'

// ========================================
// Production Environment Parameters
// Azure App Service: xorbix-vdab-prd   |   Key Vault: xorbixvdabprdkv
// Public URL: https://app.vdab.ai      |   Lakebase branch: prd
// ========================================

param environment = 'prd'
param location = 'northcentralus'
param companyPrefix = 'xorbix'
param appPrefix = 'vdab'

// Canonical public URL (custom domain bound to xorbix-vdab-prd). Used for email links.
param frontendUrl = 'https://app.vdab.ai'

// App Service Plan sizing — production is always on, on Standard tier (required for deployment slots).
param appServicePlanSkuName = 'S1'
param appServicePlanSkuTier = 'Standard'
param appServicePlanCapacity = 1
param appServiceAlwaysOn = true

// Blue-green releases: deploy to the 'staging' slot, then swap into the live site. Standard tier supports slots.
param deployDeploymentSlot = true
param deploymentSlotName = 'staging'

// JWT Configuration
param jwtIssuer = 'https://app.vdab.ai'
param jwtAudience = 'https://app.vdab.ai'
param jwtExpirationMinutes = 60
param jwtRefreshTokenExpirationDays = 7

// Tenant Invite Configuration
param tenantInviteTokenExpirationDays = 7
param tenantInviteMaxBatchSize = 50

// Policy Consent Configuration (ISO yyyy-MM-dd version dates)
param termsOfServiceVersionDate = '2026-03-16'
param privacyPolicyVersionDate = '2026-03-16'

// CORS — production custom domains (both cut over from dev at go-live) plus the default App Service host
// (used before DNS cutover). frontendUrl stays app.vdab.ai as the canonical link host.
param allowedOrigins = 'https://app.vdab.ai;https://app.vdab.io;https://xorbix-vdab-prd.azurewebsites.net'

// Secrets (JWT signing key, Postgres connection string, Stripe keys, Databricks token, GeoLite) are seeded
// out-of-band via secrets.bicep and are NOT set in this file — see .documentation/deployment/4-deploy-bicep.md.

// Azure Communication Service (Email) — disabled until a verified production sending domain is ready.
// Flip to true (and configure customEmailDomain) when production email is provisioned. See
// .documentation/deployment/4-deploy-bicep.md and .infrastructure/communication-service-setup.md.
param deployCommunicationService = true
param useCustomEmailDomain = true
param customEmailDomain = 'xorbix.com'
param emailSenderDisplayName = 'VDAB Notifications'
param emailSenderUsername = 'DoNotReply'

param tags = {
  Environment: 'Production'
  ManagedBy: 'Bicep'
  Project: 'Visual Databricks App Builder'
}

// Stripe — LIVE-mode. The publishable key is non-secret (it ships in the client config). The SECRET key and
// webhook secret are seeded into the production Key Vault via secrets.bicep (Stripe--SecretKey / Stripe--WebhookSecret).
param stripePublishableKey = 'pk_live_51NvLTlEHASOGtp1a7mQ2kJOs88y1UUc8r0AY5ClyhtVfJ1Tl5CvJvx9VdYp7gmoj2MbeqqPllnaGn3DkkF8ME9kB00E4ixofEN'
param stripePriceIdIndividualMonthly = 'price_1Tj4eoEHASOGtp1a3ofzSquj'
param stripePriceIdIndividualYearly = 'price_1Tj4fEEHASOGtp1aZNp8Grbb'
param stripePriceIdTeamMonthly = 'price_1Tj4gvEHASOGtp1atW6h1DtM'
param stripePriceIdTeamYearly = 'price_1Tj4hCEHASOGtp1aZPxMzy0f'
param stripePriceIdEnterpriseMonthly = ''
param stripePriceIdEnterpriseYearly = 'price_1Tj4ifEHASOGtp1ap75OmxRw'

// Databricks AI Builder — non-secret config (the access token is seeded via secrets.bicep).
param databricksAiWorkspaceUrl = 'https://dbc-bc2a5dd3-798c.cloud.databricks.com/'
param databricksAiEndpointName = 'databricks-claude-sonnet-4-6'
