using './secrets.bicep'

// ============================================================================
// EXAMPLE secret-seeding parameters. Copy to secrets.<env>.bicepparam (gitignored) and fill in real values.
//
//   cp secrets.example.bicepparam secrets.prd.bicepparam   # then edit, never commit
//   az deployment group create --resource-group vdab \
//     --template-file .infrastructure/secrets.bicep \
//     --parameters .infrastructure/secrets.prd.bicepparam
//
// Provide a value only for the secrets you want to seed or rotate; empty values are skipped (the existing
// Key Vault secret is left untouched).
// ============================================================================

param environment = 'dev' // dev | stg | prd — selects the Key Vault (xorbixvdab<env>kv)
param companyPrefix = 'xorbix'
param appPrefix = 'vdab'

// Set true on the FIRST deploy of an environment to generate the JWT signing key. Leave false afterward.
param seedJwtSecret = true

param postgresConnectionString = '' // Npgsql conn string for this env's Lakebase branch (…;Ssl Mode=Require;)
param stripeSecretKey = ''           // sk_test_... (dev/stg) | sk_live_... (prd)
param stripeWebhookSecret = ''       // whsec_... (per Stripe webhook endpoint)
param databricksAiAccessToken = ''   // Databricks personal access token
param geoLiteAccountId = ''          // MaxMind GeoLite account id
param geoLiteLicenseKey = ''         // MaxMind GeoLite license key
