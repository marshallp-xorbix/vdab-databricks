using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configuration for JWT authentication.
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class JwtConfiguration
{
    public const string ConfigurationSectionName = "JwtConfiguration";

    /// <summary>
    /// Gets or sets the secret key used to sign JWT tokens.
    /// </summary>
    public required string SecretKey { get; init; }

    /// <summary>
    /// Gets or sets the issuer of the JWT token.
    /// </summary>
    public required string Issuer { get; init; }

    /// <summary>
    /// Gets or sets the audience of the JWT token.
    /// </summary>
    public required string Audience { get; init; }

    /// <summary>
    /// Gets or sets the token expiration in minutes.
    /// </summary>
    public int ExpirationMinutes { get; init; } = 60;

    /// <summary>
    /// Gets or sets the refresh token expiration in days.
    /// </summary>
    public int RefreshTokenExpirationDays { get; init; } = 7;
}