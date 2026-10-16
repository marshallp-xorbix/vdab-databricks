targetScope = 'resourceGroup'

// ========================================
// Parameters
// ========================================

@description('Deployment environment (dev, stg, prd)')
@allowed(['dev', 'stg', 'prd'])
param environment string

@description('Canonical public frontend URL (custom domain) used for email links and OAuth fallbacks. When empty, the standard App Service URL (https://{appServiceName}.azurewebsites.net) is used.')
param frontendUrl string = ''

@description('App Service Plan SKU name (e.g., B1, P1v3). Override per environment to scale prd independently of dev/stg.')
param appServicePlanSkuName string = 'B1'

@description('App Service Plan SKU tier (e.g., Basic, PremiumV3).')
param appServicePlanSkuTier string = 'Basic'

@description('App Service Plan instance count.')
@minValue(1)
param appServicePlanCapacity int = 1

@description('Keep the App Service always on. Recommended true for stg/prd to avoid cold starts; leave false for dev to reduce cost.')
param appServiceAlwaysOn bool = false

@description('Deploy a deployment slot for near-zero-downtime (blue-green) releases. Requires a Standard tier or higher App Service Plan (Basic does not support slots). Enable for production; the pipeline deploys to the slot and swaps it into the live site.')
param deployDeploymentSlot bool = false

@description('Name of the deployment slot created when deployDeploymentSlot=true. NOTE: this is the production App Service\'s swap slot — it is NOT the stg environment (xorbix-vdab-stg).')
param deploymentSlotName string = 'staging'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Company/organization prefix')
param companyPrefix string = 'xorbix'

@description('Application name prefix')
param appPrefix string = 'vdab'

@description('Tags to apply to all resources')
param tags object = {}

@description('JWT Issuer URL (e.g., https://api.yourdomain.com)')
param jwtIssuer string

@description('JWT Audience URL (e.g., https://app.yourdomain.com)')
param jwtAudience string

@description('JWT token expiration in minutes')
param jwtExpirationMinutes int = 60

@description('JWT refresh token expiration in days')
param jwtRefreshTokenExpirationDays int = 7

@description('Tenant invite token expiration in days')
param tenantInviteTokenExpirationDays int = 7

@description('Maximum number of tenant invites accepted in a single batch request')
param tenantInviteMaxBatchSize int = 50

@description('Current published version date of the Terms of Service (ISO yyyy-MM-dd). Users whose stored version does not match must re-accept before gaining full access.')
param termsOfServiceVersionDate string = '2026-03-16'

@description('Current published version date of the Privacy Policy (ISO yyyy-MM-dd). Users whose stored version does not match must re-accept before gaining full access.')
param privacyPolicyVersionDate string = '2026-03-16'

@description('Allowed CORS origins (comma-separated or * for all)')
param allowedOrigins string = '*'

@description('Stripe publishable key')
param stripePublishableKey string = ''

@description('Stripe Price ID for Individual tier - Monthly')
param stripePriceIdIndividualMonthly string = ''

@description('Stripe Price ID for Individual tier - Yearly')
param stripePriceIdIndividualYearly string = ''

@description('Stripe Price ID for Team tier - Monthly')
param stripePriceIdTeamMonthly string = ''

@description('Stripe Price ID for Team tier - Yearly')
param stripePriceIdTeamYearly string = ''

@description('Stripe Price ID for Enterprise tier - Monthly')
param stripePriceIdEnterpriseMonthly string = ''

@description('Stripe Price ID for Enterprise tier - Yearly')
param stripePriceIdEnterpriseYearly string = ''

@description('Deploy Azure Communication Service for email')
param deployCommunicationService bool = false

@description('Use custom email domain for sending emails (set to true to enable)')
param useCustomEmailDomain bool = false

@description('Custom email domain (leave empty to use Azure Managed Domain only)')
param customEmailDomain string = ''

@description('Email sender display name')
param emailSenderDisplayName string = 'VDAB Notifications'

@description('Email sender username (e.g., noreply, donotreply)')
param emailSenderUsername string = 'donotreply'

@description('Databricks workspace URL for AI Builder (e.g., https://dbc-xxx.cloud.databricks.com/). Leave empty to set manually in Azure App Service Configuration.')
param databricksAiWorkspaceUrl string = ''

@description('Databricks Model Serving endpoint name for AI Builder. Leave empty to set manually in Azure App Service Configuration.')
param databricksAiEndpointName string = ''

@description('Object ID of an Entra ID group (e.g., VDAB-KeyVault-Access) to grant Key Vault Secrets Officer (read/write/manage secrets) for human/operator secret management. Leave empty to skip the assignment.')
param keyVaultAccessGroupObjectId string = ''

// ========================================
// Variables
// ========================================

var resourcePrefix = '${companyPrefix}-${appPrefix}-${environment}'
var appInsightsName = resourcePrefix
var keyVaultName = take(replace('${companyPrefix}${appPrefix}${environment}kv', '-', ''), 24)
var keyStorageAccountName = take(replace('${companyPrefix}${appPrefix}${environment}keyst', '-', ''), 24)
var appStorageAccountName = take(replace('${companyPrefix}${appPrefix}${environment}appst', '-', ''), 24)
var appServicePlanName = '${resourcePrefix}-plan'
var appServiceName = resourcePrefix
var resolvedFrontendUrl = empty(frontendUrl) ? 'https://${appServiceName}.azurewebsites.net' : frontendUrl
var emailServiceName = '${resourcePrefix}-emailservice'
// Per-environment communication service for every environment (dev/stg/prd) for consistent naming.
// NOTE: dev's first redeploy creates xorbix-vdab-dev-commservice and leaves the legacy
// xorbix-vdab-commservice orphaned — delete the old one manually after verifying dev email still works.
var communicationServiceName = '${resourcePrefix}-commservice'
var logAnalyticsWorkspaceName = '${resourcePrefix}-logs'

// ========================================
// Application Insights
// ========================================

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    RetentionInDays: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ========================================
// Key Vault
// ========================================
@description('Key Vault Secrets User role. See https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#key-vault-secrets-user')
resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleDefinitions@2018-01-01-preview' existing = {
  scope: subscription()
  name: '4633458b-17de-408a-b874-0445c86b69e6'
}

@description('Key Vault Crypto User role. Required for Data Protection key wrap/unwrap operations. See https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#key-vault-crypto-user')
resource keyVaultCryptoUserRole 'Microsoft.Authorization/roleDefinitions@2018-01-01-preview' existing = {
  scope: subscription()
  name: '12338af0-0e69-4776-bea7-57ae8d297424'
}

@description('Storage Blob Data Contributor role. See https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#storage-blob-data-contributor')
resource storageBlobDataContributorRole 'Microsoft.Authorization/roleDefinitions@2018-01-01-preview' existing = {
  scope: subscription()
  name: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
}

@description('Key Vault Secrets Officer role. Grants read/write/manage on secrets (no key or certificate management). See https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#key-vault-secrets-officer')
resource keyVaultSecretsOfficerRole 'Microsoft.Authorization/roleDefinitions@2018-01-01-preview' existing = {
  scope: subscription()
  name: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
}

resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enabledForTemplateDeployment: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
  }
}

// Externally-sourced secrets — JwtConfiguration--SecretKey, ConnectionStrings--PostgreSql, Stripe--SecretKey,
// Stripe--WebhookSecret, DatabricksAi--AccessToken, GeoLite--AccountId, GeoLite--LicenseKey — are seeded
// out-of-band by secrets.bicep (run manually; values never committed). See
// .documentation/deployment/4-deploy-bicep.md. The secrets below are DERIVED from resources this template
// creates, so they are managed here.

// Store Application Insights Connection String in Key Vault
resource appInsightsConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'ConnectionStrings--ApplicationInsights'
  properties: {
    value: appInsights.properties.ConnectionString
  }
}

// Store Encryption Blob URI in Key Vault
resource encryptionBlobUriSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'Encryption--BlobUri'
  properties: {
    value: '${keyStorageAccount.properties.primaryEndpoints.blob}keys/keys.xml'
  }
}

// Store Storage Blob URI in Key Vault
resource storageBlobUriSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'Storage--BlobUri'
  properties: {
    value: appStorageAccount.properties.primaryEndpoints.blob
  }
}

// Store Legacy Key (Placeholder) in Key Vault
resource legacyKeySecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'Encryption--LegacyKey'
  properties: {
    value: 'abjdty38dl49dj3h4h5jdpqlah48i302'
  }
}

// Store Legacy IV (Placeholder) in Key Vault
resource legacyIvSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'Encryption--LegacyIv'
  properties: {
    value: 'jdpeld73639kg916'
  }
}

// Create a Key for Data Protection
resource dataProtectionKey 'Microsoft.KeyVault/vaults/keys@2023-07-01' = {
  parent: keyVault
  name: 'DataProtectionKey'
  properties: {
    kty: 'RSA'
    keySize: 2048
    attributes: {
      enabled: true
    }
  }
}

// ========================================
// Log Analytics Workspace (for Email Service Diagnostics)
// ========================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (deployCommunicationService) {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: -1
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ========================================
// Azure Communication Service - Email
// ========================================

resource emailService 'Microsoft.Communication/emailServices@2023-06-01-preview' = if (deployCommunicationService) {
  name: emailServiceName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
  }
}

// Azure Managed Email Domain (always created when deploying communication service)
resource emailServiceManagedDomain 'Microsoft.Communication/emailServices/domains@2023-06-01-preview' = if (deployCommunicationService) {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  tags: tags
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

// Custom Email Domain (only created if customEmailDomain is provided)
resource emailServiceCustomDomain 'Microsoft.Communication/emailServices/domains@2023-06-01-preview' = if (deployCommunicationService && !empty(customEmailDomain)) {
  parent: emailService
  name: customEmailDomain
  location: 'global'
  tags: tags
  properties: {
    domainManagement: 'CustomerManaged'
    userEngagementTracking: 'Disabled'
  }
}

// Sender Username for Azure Managed Domain
resource emailManagedDomainSenderUsername 'Microsoft.Communication/emailServices/domains/senderUsernames@2023-06-01-preview' = if (deployCommunicationService) {
  parent: emailServiceManagedDomain
  name: emailSenderUsername
  properties: {
    username: 'DoNotReply'
    displayName: emailSenderDisplayName
  }
}

// Sender Username for Custom Domain (only if custom domain is provided)
resource emailCustomDomainSenderUsername 'Microsoft.Communication/emailServices/domains/senderUsernames@2023-06-01-preview' = if (deployCommunicationService && !empty(customEmailDomain)) {
  parent: emailServiceCustomDomain
  name: emailSenderUsername
  properties: {
    username: emailSenderUsername
    displayName: emailSenderDisplayName
  }
}

// Communication Service (links to email domains)
resource communicationService 'Microsoft.Communication/CommunicationServices@2023-06-01-preview' = if (deployCommunicationService) {
  name: communicationServiceName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
    // Only link the Azure Managed Domain initially.
    // Custom domains must be verified (DNS records) before they can be linked.
    // Link your custom domain manually in the Azure Portal after verification.
    linkedDomains: [
      emailServiceManagedDomain.id
    ]
  }
}

// Diagnostic Settings for Communication Service
resource communicationServiceDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (deployCommunicationService) {
  name: '${communicationServiceName}-diagnostics'
  scope: communicationService
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [
      {
        category: 'EmailSendMailOperational'
        enabled: true
      }
      {
        category: 'EmailStatusUpdateOperational'
        enabled: true
      }
      {
        category: 'EmailUserEngagementOperational'
        enabled: true
      }
    ]
  }
}

// Store Communication Service Connection String in Key Vault
resource communicationServiceConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = if (deployCommunicationService) {
  parent: keyVault
  name: 'ConnectionStrings--CommunicationService'
  properties: {
    value: communicationService!.listKeys().primaryConnectionString
  }
}

// ========================================
// Storage Account (for Data Protection Keys)
// ========================================

resource keyStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: keyStorageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Enabled'
  }
}

resource keyBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: keyStorageAccount
  name: 'default'
}

resource keysContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: keyBlobService
  name: 'keys'
  properties: {
    publicAccess: 'None'
  }
}

// ========================================
// Storage Account (General Purpose)
// ========================================

resource appStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: appStorageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Enabled'
  }
}

resource appBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: appStorageAccount
  name: 'default'
}

resource geoLiteContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: appBlobService
  name: 'geolite'
  properties: {
    publicAccess: 'None'
  }
}

resource auditArchiveContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: appBlobService
  name: 'audit-archive'
  properties: {
    publicAccess: 'None'
  }
}

// ========================================
// App Service Plan & App Service
// ========================================

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServicePlanSkuName
    tier: appServicePlanSkuTier
    capacity: appServicePlanCapacity
  }
  kind: 'app'
  tags: tags
  properties: {
    reserved: false
  }
}

// Shared App Service site configuration. Reused by the production deployment slot below so the slot runs an
// identical configuration before it is swapped into the live site. Keep this as the single definition.
var appServiceSiteConfig = {
  netFrameworkVersion: 'v10.0'
  alwaysOn: appServiceAlwaysOn
  minTlsVersion: '1.2'
  ftpsState: 'FtpsOnly'
  appSettings: [
    {
      name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
      value: '~3'
    }
    {
      name: 'XDT_MicrosoftApplicationInsights_Mode'
      value: 'recommended'
    }
    {
      name: 'ApplicationConfiguration__AllowedOrigins'
      value: allowedOrigins
    }
    {
      name: 'ApplicationConfiguration__FrontendUrl'
      value: resolvedFrontendUrl
    }
    {
      name: 'KeyVault__Uri'
      value: keyVault.properties.vaultUri
    }
    {
      name: 'JwtConfiguration__SecretKey'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/JwtConfiguration--SecretKey)'
    }
    {
      name: 'JwtConfiguration__Issuer'
      value: jwtIssuer
    }
    {
      name: 'JwtConfiguration__Audience'
      value: jwtAudience
    }
    {
      name: 'JwtConfiguration__ExpirationMinutes'
      value: string(jwtExpirationMinutes)
    }
    {
      name: 'JwtConfiguration__RefreshTokenExpirationDays'
      value: string(jwtRefreshTokenExpirationDays)
    }
    {
      name: 'TenantInviteConfiguration__TokenExpirationDays'
      value: string(tenantInviteTokenExpirationDays)
    }
    {
      name: 'TenantInviteConfiguration__MaxBatchSize'
      value: string(tenantInviteMaxBatchSize)
    }
    {
      name: 'PolicyConsentConfiguration__TermsOfServiceVersionDate'
      value: termsOfServiceVersionDate
    }
    {
      name: 'PolicyConsentConfiguration__PrivacyPolicyVersionDate'
      value: privacyPolicyVersionDate
    }
    {
      name: 'Stripe__SecretKey'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/Stripe--SecretKey)'
    }
    {
      name: 'Stripe__WebhookSecret'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/Stripe--WebhookSecret)'
    }
    {
      name: 'Stripe__PublishableKey'
      value: stripePublishableKey
    }
    {
      name: 'Stripe__PriceIds__Individual__Monthly'
      value: stripePriceIdIndividualMonthly
    }
    {
      name: 'Stripe__PriceIds__Individual__Yearly'
      value: stripePriceIdIndividualYearly
    }
    {
      name: 'Stripe__PriceIds__Team__Monthly'
      value: stripePriceIdTeamMonthly
    }
    {
      name: 'Stripe__PriceIds__Team__Yearly'
      value: stripePriceIdTeamYearly
    }
    {
      name: 'Stripe__PriceIds__Enterprise__Monthly'
      value: stripePriceIdEnterpriseMonthly
    }
    {
      name: 'Stripe__PriceIds__Enterprise__Yearly'
      value: stripePriceIdEnterpriseYearly
    }
    {
      name: 'EmailConfiguration__UseCustomDomain'
      value: 'false' //useCustomEmailDomain ? 'true' : 'false'
    }
    {
      name: 'EmailConfiguration__CustomDomain__Domain'
      value: customEmailDomain
    }
    {
      name: 'EmailConfiguration__CustomDomain__SenderUsername'
      value: emailSenderUsername
    }
    {
      name: 'EmailConfiguration__AzureManagedDomain__Domain'
      value: deployCommunicationService ? emailServiceManagedDomain!.properties.fromSenderDomain : ''
    }
    {
      name: 'EmailConfiguration__AzureManagedDomain__SenderUsername'
      value: 'DoNotReply'
    }
    {
      name: 'Encryption__BlobUri'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/Encryption--BlobUri)'
    }
    {
      name: 'Storage__BlobUri'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/Storage--BlobUri)'
    }
    {
      name: 'Encryption__KeyUri'
      value: dataProtectionKey.properties.keyUriWithVersion
    }
    {
      name: 'Encryption__LegacyKey'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/Encryption--LegacyKey)'
    }
    {
      name: 'Encryption__LegacyIv'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/Encryption--LegacyIv)'
    }
    {
      name: 'GeoLiteConfiguration__DatabasePath'
      value: '/home/data/geolite/GeoLite2-City.mmdb'
    }
    {
      name: 'GeoLiteConfiguration__ContainerUri'
      value: '${appStorageAccount.properties.primaryEndpoints.blob}geolite'
    }
    {
      name: 'GeoLiteConfiguration__AccountId'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/GeoLite--AccountId)'
    }
    {
      name: 'GeoLiteConfiguration__LicenseKey'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/GeoLite--LicenseKey)'
    }
    {
      name: 'AuditArchiveConfiguration__ContainerUri'
      value: '${appStorageAccount.properties.primaryEndpoints.blob}audit-archive'
    }
    {
      name: 'DatabricksAi__WorkspaceUrl'
      value: databricksAiWorkspaceUrl
    }
    {
      name: 'DatabricksAi__EndpointName'
      value: databricksAiEndpointName
    }
    {
      name: 'DatabricksAi__AccessToken'
      value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/DatabricksAi--AccessToken)'
    }
  ]
  connectionStrings: [
    {
      name: 'ApplicationInsights'
      connectionString: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/ConnectionStrings--ApplicationInsights)'
      type: 'Custom'
    }
    {
      name: 'PostgreSql'
      connectionString: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/ConnectionStrings--PostgreSql)'
      type: 'Custom'
    }
    {
      name: 'CommunicationService'
      connectionString: deployCommunicationService
        ? '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/ConnectionStrings--CommunicationService)'
        : ''
      type: 'Custom'
    }
  ]
}

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  tags: union(tags, {
    'hidden-link: /app-insights-resource-id': appInsights.id
  })
  kind: 'app'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: appServiceSiteConfig
  }
}

// Grant App Service access to Key Vault secrets (requires App Service to be created first)
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, appService.id, keyVaultSecretsUserRole.id, 'secrets')
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRole.id
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant App Service access to Key Vault keys for Data Protection wrap/unwrap operations
resource keyVaultCryptoRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, appService.id, keyVaultCryptoUserRole.id, 'crypto')
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultCryptoUserRole.id
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant an operator/admin Entra group (e.g., VDAB-KeyVault-Access) management access to Key Vault secrets.
// Created only when keyVaultAccessGroupObjectId is supplied so human operators can read/seed/rotate secrets.
resource keyVaultAccessGroupRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(keyVaultAccessGroupObjectId)) {
  name: guid(subscription().id, keyVault.id, keyVaultSecretsOfficerRole.id, keyVaultAccessGroupObjectId)
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsOfficerRole.id
    principalId: keyVaultAccessGroupObjectId
    principalType: 'Group'
  }
}

// Grant App Service access to Storage Account blobs (for Data Protection keys)
resource keyStorageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyStorageAccount.id, appService.id, storageBlobDataContributorRole.id)
  scope: keyStorageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributorRole.id
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant App Service access to General Storage Account blobs
resource appStorageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appStorageAccount.id, appService.id, storageBlobDataContributorRole.id)
  scope: appStorageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributorRole.id
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ========================================
// Deployment Slot (blue-green production releases)
// ========================================
// Created only when deployDeploymentSlot=true (production, on a Standard tier or higher plan). The pipeline
// deploys the new build to this slot, warms it up, then swaps it into the live site for near-zero-downtime
// releases. The slot runs the identical site configuration and shares the App Service Plan, Key Vault, and
// database with the production slot. NOTE: this is the prod App Service's swap slot, not the stg environment.

resource appServiceSlot 'Microsoft.Web/sites/slots@2023-12-01' = if (deployDeploymentSlot) {
  parent: appService
  name: deploymentSlotName
  location: location
  kind: 'app'
  identity: {
    type: 'SystemAssigned'
  }
  tags: union(tags, {
    'hidden-link: /app-insights-resource-id': appInsights.id
  })
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: appServiceSiteConfig
  }
}

// The slot has its OWN system-assigned identity (identities are not exchanged during a swap), so it needs the
// same Key Vault + Storage access as the production slot to resolve its Key Vault references.
resource slotKeyVaultSecretsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployDeploymentSlot) {
  name: guid(subscription().id, appServiceSlot!.id, keyVaultSecretsUserRole.id, 'secrets')
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRole.id
    principalId: appServiceSlot!.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource slotKeyVaultCryptoRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployDeploymentSlot) {
  name: guid(subscription().id, appServiceSlot!.id, keyVaultCryptoUserRole.id, 'crypto')
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultCryptoUserRole.id
    principalId: appServiceSlot!.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource slotKeyStorageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployDeploymentSlot) {
  name: guid(keyStorageAccount.id, appServiceSlot!.id, storageBlobDataContributorRole.id)
  scope: keyStorageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributorRole.id
    principalId: appServiceSlot!.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource slotAppStorageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployDeploymentSlot) {
  name: guid(appStorageAccount.id, appServiceSlot!.id, storageBlobDataContributorRole.id)
  scope: appStorageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributorRole.id
    principalId: appServiceSlot!.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ========================================
// Outputs
// ========================================

output appInsightsName string = appInsights.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

output appServiceName string = appService.name
output appServiceHostName string = appService.properties.defaultHostName
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output appServicePlanName string = appServicePlan.name
output deploymentSlotName string = deployDeploymentSlot ? deploymentSlotName : ''

output emailServiceName string = deployCommunicationService ? emailServiceName : ''
output communicationServiceName string = deployCommunicationService ? communicationServiceName : ''
output emailSenderUsername string = deployCommunicationService
  ? (!empty(customEmailDomain)
      ? emailCustomDomainSenderUsername!.properties.username
      : emailManagedDomainSenderUsername!.properties.username)
  : ''
output emailCustomDomain string = !empty(customEmailDomain) ? customEmailDomain : ''
output emailManagedDomain string = deployCommunicationService
  ? emailServiceManagedDomain!.properties.fromSenderDomain
  : ''
output logAnalyticsWorkspaceName string = deployCommunicationService ? logAnalyticsWorkspaceName : ''
