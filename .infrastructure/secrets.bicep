targetScope = 'resourceGroup'

// ============================================================================
// Key Vault secret seeding — externally-sourced secrets only.
//
// Run this MANUALLY (never from the pipeline) to seed or rotate the secrets that originate OUTSIDE the
// infrastructure: the database connection string, Stripe keys, the Databricks token, GeoLite credentials, and
// the JWT signing key. It targets the EXISTING Key Vault created by main.bicep and writes only the secrets you
// supply a value for, so you can seed everything on first deploy or rotate a single value later.
//
//   az deployment group create --resource-group vdab \
//     --template-file .infrastructure/secrets.bicep \
//     --parameters .infrastructure/secrets.<env>.bicepparam
//
// Real secrets.<env>.bicepparam files are gitignored; secrets.example.bicepparam (committed) shows the shape.
// DERIVED secrets (App Insights connection string, storage/encryption URIs, ACS connection string) are NOT here
// — they are computed from resources and stay in main.bicep.
// ============================================================================

@description('Deployment environment (dev, stg, prd) — selects the Key Vault.')
@allowed(['dev', 'stg', 'prd'])
param environment string

@description('Company/organization prefix (must match main.bicep).')
param companyPrefix string = 'xorbix'

@description('Application name prefix (must match main.bicep).')
param appPrefix string = 'vdab'

@description('Seed the JWT signing key (JwtConfiguration--SecretKey). Set true on the first deploy of an environment; the value is generated deterministically per environment. Leave false afterward so a later rotation is not overwritten.')
param seedJwtSecret bool = false

@description('PostgreSQL/Lakebase connection string for this environment\'s branch. Empty = leave the existing secret untouched.')
@secure()
param postgresConnectionString string = ''

@description('Stripe secret API key (sk_test_... for dev/stg, sk_live_... for prd). Empty = skip.')
@secure()
param stripeSecretKey string = ''

@description('Stripe webhook signing secret (whsec_...). Empty = skip.')
@secure()
param stripeWebhookSecret string = ''

@description('Databricks access token for AI Builder. Empty = skip.')
@secure()
param databricksAiAccessToken string = ''

@description('GeoLite (MaxMind) account id. Empty = skip.')
@secure()
param geoLiteAccountId string = ''

@description('GeoLite (MaxMind) license key. Empty = skip.')
@secure()
param geoLiteLicenseKey string = ''

// Same Key Vault name derivation as main.bicep (≤ 24 chars, no hyphens).
var keyVaultName = take(replace('${companyPrefix}${appPrefix}${environment}kv', '-', ''), 24)

resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' existing = {
  name: keyVaultName
}

// JWT signing key — generated (deterministic per environment), seeded on demand.
resource jwtSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = if (seedJwtSecret) {
  parent: keyVault
  name: 'JwtConfiguration--SecretKey'
  properties: {
    value: base64(guid(resourceGroup().id, environment, 'jwt-secret'))
  }
}

resource postgresSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = if (!empty(postgresConnectionString)) {
  parent: keyVault
  name: 'ConnectionStrings--PostgreSql'
  properties: {
    value: postgresConnectionString
  }
}

resource stripeSecretKeySecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = if (!empty(stripeSecretKey)) {
  parent: keyVault
  name: 'Stripe--SecretKey'
  properties: {
    value: stripeSecretKey
  }
}

resource stripeWebhookSecretSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = if (!empty(stripeWebhookSecret)) {
  parent: keyVault
  name: 'Stripe--WebhookSecret'
  properties: {
    value: stripeWebhookSecret
  }
}

resource databricksAiAccessTokenSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = if (!empty(databricksAiAccessToken)) {
  parent: keyVault
  name: 'DatabricksAi--AccessToken'
  properties: {
    value: databricksAiAccessToken
  }
}

resource geoLiteAccountIdSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = if (!empty(geoLiteAccountId)) {
  parent: keyVault
  name: 'GeoLite--AccountId'
  properties: {
    value: geoLiteAccountId
  }
}

resource geoLiteLicenseKeySecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = if (!empty(geoLiteLicenseKey)) {
  parent: keyVault
  name: 'GeoLite--LicenseKey'
  properties: {
    value: geoLiteLicenseKey
  }
}
