using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

[ExcludeFromCodeCoverage]
public static class TableNames
{
    public const string Users = "Users";
    public const string Roles = "Roles";
    public const string UserRoles = "UserRoles";
    public const string UserClaims = "UserClaims";
    public const string UserLogins = "UserLogins";
    public const string UserTokens = "UserTokens";
    public const string RoleClaims = "RoleClaims";
    public const string RefreshTokens = "RefreshTokens";
    public const string DatabricksConnections = "DatabricksConnections";
    public const string DatabricksUserTokens = "DatabricksUserTokens";
    public const string Tenants = "Tenants";
    public const string SubscriptionHistory = "SubscriptionHistory";
    public const string StripeEventLogs = "StripeEventLogs";
    public const string SubscriptionSeats = "SubscriptionSeats";
    public const string AuditLogs = "AuditLogs";
    public const string Apps = "Apps";
    public const string AppComponents = "AppComponents";
    public const string UserTenantMemberships = "UserTenantMemberships";
    public const string TenantInvites = "TenantInvites";
    public const string BetaCodes = "BetaCodes";
    public const string BetaCodeRedemptions = "BetaCodeRedemptions";
    public const string TenantAiModels = "TenantAiModels";
    public const string UserTenantPreferences = "UserTenantPreferences";
    public const string UserPlatformAiUsage = "UserPlatformAiUsage";
    public const string UserPlatformAiUsageEvents = "UserPlatformAiUsageEvents";
}

/// <summary>
/// Database index names referenced from application code (e.g. unique-violation mapping).
/// </summary>
[ExcludeFromCodeCoverage]
public static class IndexNames
{
    public const string UserTenantMembershipsUserIdTenantId =
        "IX_UserTenantMemberships_UserId_TenantId";

    public const string UserTenantMembershipsUserIdIsDefault =
        "IX_UserTenantMemberships_UserId_IsDefault";
}

/// <summary>
/// Default values for platform AI Builder monthly token quotas.
/// </summary>
[ExcludeFromCodeCoverage]
public static class PlatformAiQuotaDefaults
{
    public const long MonthlyTokenLimit = 100_000;

    public const string PeriodKeyFormat = "yyyy-MM";

    public const int UsagePercentOrangeThreshold = 50;

    public const int UsagePercentRedThreshold = 85;

    public const int TokensPerThousandDivisor = 1_000;
}

/// <summary>
/// User-facing copy for platform AI Builder quota messaging.
/// </summary>
[ExcludeFromCodeCoverage]
public static class PlatformAiQuotaMessages
{
    public const string QuotaExceededTitle = "Monthly VDAB Default limit reached";

    public const string QuotaExceededFallbackMessage = "Monthly VDAB Default token limit reached.";

    public const string SwitchToTenantModelSuggestedAction =
        "Switch to a tenant AI model or wait until your monthly quota resets.";

    public const string ExceededMessageTemplate =
        "Monthly VDAB Default limit reached ({0} tokens). Resets {1:MMMM d, yyyy} UTC, or switch to a tenant AI model.";
}

/// <summary>
/// JSON property names on OpenAI-compatible chat completion responses.
/// </summary>
[ExcludeFromCodeCoverage]
public static class OpenAiChatCompletionJsonProperties
{
    public const string Usage = "usage";

    public const string TotalTokens = "total_tokens";

    public const string PromptTokens = "prompt_tokens";

    public const string CompletionTokens = "completion_tokens";
}

/// <summary>
/// Lifecycle status values for <c>TenantInvite</c> rows.
/// </summary>
[ExcludeFromCodeCoverage]
public static class TenantInviteStatuses
{
    public const string Pending = "Pending";
    public const string Accepted = "Accepted";
    public const string Canceled = "Canceled";
    public const string Expired = "Expired";
}

[ExcludeFromCodeCoverage]
public static class SchemaNames
{
    public const string Iam = "iam";
    public const string Dbo = "dbo";
}

[ExcludeFromCodeCoverage]
public static class UrlParams
{
    public const string UserId = "userId";
    public const string ResetToken = "resetToken";
    public const string ConfirmToken = "confirmToken";
    public const string NewEmail = "newEmail";
    public const string Tier = "tier";
}

[ExcludeFromCodeCoverage]
public static class ClientRoutes
{
    public const string ConfirmEmail = "confirm-email";
    public const string ResetPassword = "reset-password";
    public const string ConfirmEmailChange = "confirm-email-change";
    public const string AccountSetup = "account-setup";
    public const string AcceptInvite = "accept-invite";
    public const string Passwordless = "passwordless";
}

[ExcludeFromCodeCoverage]
public static class FeatureManagementNames
{
    public const string EnablePreRelease = "EnablePreRelease";
}

[ExcludeFromCodeCoverage]
public static class RateLimitingPolicyNames
{
    public const string FeaturesAnonymous = "features-anonymous";

    /// <summary>
    /// Coarse per-IP backstop for the anonymous identity endpoints. The real brute-force control is
    /// the per-email issuance backoff in the service layer; this only catches crude flooding.
    /// </summary>
    public const string IdentityAnonymous = "identity-anonymous";
}

[ExcludeFromCodeCoverage]
public static class RateLimitingDefaults
{
    public const int FeaturesAnonymousPermitLimit = 60;
    public const int FeaturesAnonymousWindowSeconds = 60;

    // Deliberately generous: behind App Service this partitions on the platform/proxy IP, so every
    // client can share one bucket. It must never be the thing that stops a legitimate sign-in.
    public const int IdentityAnonymousPermitLimit = 300;
    public const int IdentityAnonymousWindowSeconds = 60;
    public const string ForwardedForHeaderName = "X-Forwarded-For";
    public const bool EnableForwardedHeaders = true;
    public const bool TrustAllForwardedHeaders = false;
}

/// <summary>
/// Input type values for the TextInput component's <c>Type</c> property.
/// Mirrors the Streamlit <c>type</c> argument on <c>st.text_input</c>.
/// </summary>
[ExcludeFromCodeCoverage]
public static class TextInputTypes
{
    public const string Default = "default";
    public const string Password = "password";
}

/// <summary>
/// Shared constants for AI Builder model selection and resolution.
/// </summary>
[ExcludeFromCodeCoverage]
public static class AiBuilderConstants
{
    public const string PlatformDefaultDisplayName = "VDAB Default";
}

/// <summary>
/// Keys stored in <see cref="EF.UserTenantPreference.PreferencesJson"/>.
/// </summary>
[ExcludeFromCodeCoverage]
public static class UserTenantPreferenceKeys
{
    public const string AiBuilderSelectedModelId = "aiBuilder.selectedModelId";
}

/// <summary>
/// Keys for the <c>Databricks-Ai-Gateway-Request-Tags</c> HTTP header JSON object.
/// </summary>
[ExcludeFromCodeCoverage]
public static class AiBuilderGatewayTagKeys
{
    public const string HeaderName = "Databricks-Ai-Gateway-Request-Tags";
    public const string EndUser = "end_user";
    public const string Source = "source";
    public const string Feature = "feature";
    public const string TenantId = "tenant_id";
    public const string TenantName = "tenant_name";
    public const string UserId = "user_id";
    public const string AppId = "app_id";
    public const string AppName = "app_name";
    public const string ModelSource = "model_source";
    public const string TenantAiModelId = "tenant_ai_model_id";
    public const string EndpointName = "endpoint_name";
}

/// <summary>
/// Keys for storing AI Builder gateway tag state on the active HTTP request.
/// </summary>
[ExcludeFromCodeCoverage]
public static class AiBuilderGatewayTagContextKeys
{
    public const string HttpContextItemKey = "AiBuilderGatewayTags";
}

/// <summary>
/// Values for well-known <see cref="AiBuilderGatewayTagKeys"/> entries.
/// </summary>
[ExcludeFromCodeCoverage]
public static class AiBuilderGatewayTagValues
{
    public const string Source = "vdab";
    public const string FeatureAiBuilder = "ai-builder";
    public const string ModelSourcePlatform = "platform";
    public const string ModelSourceTenant = "tenant";
}

/// <summary>
/// Shared pixel height bounds for chat and dashboard embed components.
/// IMPORTANT: Keep in sync with frontend <c>heightPixelsUtils.ts</c>.
/// </summary>
[ExcludeFromCodeCoverage]
public static class ComponentHeightBounds
{
    public const int MinPixels = 300;
    public const int MaxPixels = 2000;
    public const int DefaultPixels = 600;
}

/// <summary>
/// Severity values persisted on <see cref="EF.AuditLog"/> rows.
/// Keep in sync with frontend <c>AUDIT_SEVERITIES</c>.
/// </summary>
[ExcludeFromCodeCoverage]
public static class AuditSeverities
{
    public const string Info = "Info";
    public const string Warning = "Warning";
    public const string Error = "Error";
    public const string Critical = "Critical";
}

/// <summary>
/// Conventions for Databricks Apps SQL warehouse resources used by generated Streamlit apps.
/// </summary>
[ExcludeFromCodeCoverage]
public static class DatabricksAppsSqlWarehouseResource
{
    /// <summary>
    /// Default app resource key referenced by generated <c>app.yaml</c>
    /// (<c>DATABRICKS_WAREHOUSE_ID</c> ← <c>valueFrom</c>).
    /// </summary>
    public const string DefaultResourceKey = "sql-warehouse";
}

/// <summary>
/// Placeholder identity values written when a retired account is anonymized.
/// </summary>
[ExcludeFromCodeCoverage]
public static class RetiredUserAnonymization
{
    /// <summary>Display first name applied to anonymized retired accounts.</summary>
    public const string FirstName = "Anonymized";

    /// <summary>Display last name applied to anonymized retired accounts.</summary>
    public const string LastName = "User";

    /// <summary>Prefix of the synthetic email/username (<c>anonymized-{guid}@invalid</c>).</summary>
    public const string EmailPrefix = "anonymized-";

    /// <summary>Domain of the synthetic email/username.</summary>
    public const string EmailDomain = "invalid";

    /// <summary>
    /// Builds the synthetic email (and username) for an anonymized retired user.
    /// </summary>
    /// <param name="userId">The retired user's id.</param>
    /// <returns>An address of the form <c>anonymized-{guid:D}@invalid</c>.</returns>
    public static string FormatEmail(Guid userId) => $"{EmailPrefix}{userId:D}@{EmailDomain}";
}
