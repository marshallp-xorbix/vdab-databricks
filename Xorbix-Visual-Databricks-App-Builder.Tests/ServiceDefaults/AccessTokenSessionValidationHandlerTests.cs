using System.Security.Claims;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ServiceDefaults;

/// <summary>
/// Verifies OnTokenValidated session-binding outcomes, including SessionRevoked header decisions.
/// </summary>
public class AccessTokenSessionValidationHandlerTests
{
    private static ClaimsPrincipal CreatePrincipal(
        string? nameIdentifier = null,
        string? securityStamp = "stamp",
        string? sessionId = null)
    {
        List<Claim> claims = [];
        if (nameIdentifier is not null)
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, nameIdentifier));
        }

        if (securityStamp is not null)
        {
            claims.Add(new Claim(AuthClaimTypes.SecurityStamp, securityStamp));
        }

        if (sessionId is not null)
        {
            claims.Add(new Claim(AuthClaimTypes.SessionId, sessionId));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: "Bearer"));
    }

    [Fact]
    public async Task ValidateAsync_WhenNameIdentifierMissing_FailsWithSessionRevokedHeader()
    {
        ClaimsPrincipal principal = CreatePrincipal(nameIdentifier: null);

        AccessTokenSessionValidationHandler.ValidationOutcome outcome =
            await AccessTokenSessionValidationHandler.ValidateAsync(
                principal,
                Mock.Of<IAccessTokenSessionValidator>(),
                NullLoggerFactory.Instance);

        Assert.False(outcome.Succeeded);
        Assert.True(outcome.SetSessionRevokedHeader);
        Assert.Equal("Invalid user identifier in access token.", outcome.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_WhenNameIdentifierIsUsername_FailsWithSessionRevokedHeader()
    {
        ClaimsPrincipal principal = CreatePrincipal(nameIdentifier: "not-a-guid");

        AccessTokenSessionValidationHandler.ValidationOutcome outcome =
            await AccessTokenSessionValidationHandler.ValidateAsync(
                principal,
                Mock.Of<IAccessTokenSessionValidator>(),
                NullLoggerFactory.Instance);

        Assert.False(outcome.Succeeded);
        Assert.True(outcome.SetSessionRevokedHeader);
    }

    [Fact]
    public async Task ValidateAsync_WhenValidatorUnregistered_FailsWithoutSessionRevokedHeader()
    {
        Guid userId = Guid.NewGuid();
        ClaimsPrincipal principal = CreatePrincipal(
            nameIdentifier: userId.ToString(),
            sessionId: Guid.NewGuid().ToString());

        AccessTokenSessionValidationHandler.ValidationOutcome outcome =
            await AccessTokenSessionValidationHandler.ValidateAsync(
                principal,
                validator: null,
                NullLoggerFactory.Instance);

        Assert.False(outcome.Succeeded);
        Assert.False(outcome.SetSessionRevokedHeader);
        Assert.Equal("Session validation is unavailable.", outcome.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_WhenValidatorThrows_FailsWithoutSessionRevokedHeader()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ClaimsPrincipal principal = CreatePrincipal(
            nameIdentifier: userId.ToString(),
            sessionId: sessionId.ToString());

        Mock<IAccessTokenSessionValidator> validator = new();
        validator
            .Setup(v => v.ValidateAsync(
                userId,
                "stamp",
                sessionId.ToString(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("db unavailable"));

        AccessTokenSessionValidationHandler.ValidationOutcome outcome =
            await AccessTokenSessionValidationHandler.ValidateAsync(
                principal,
                validator.Object,
                NullLoggerFactory.Instance);

        Assert.False(outcome.Succeeded);
        Assert.False(outcome.SetSessionRevokedHeader);
        Assert.Equal("Session validation failed due to a temporary error.", outcome.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_WhenSessionInvalid_FailsWithSessionRevokedHeader()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ClaimsPrincipal principal = CreatePrincipal(
            nameIdentifier: userId.ToString(),
            sessionId: sessionId.ToString());

        Mock<IAccessTokenSessionValidator> validator = new();
        validator
            .Setup(v => v.ValidateAsync(
                userId,
                "stamp",
                sessionId.ToString(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        AccessTokenSessionValidationHandler.ValidationOutcome outcome =
            await AccessTokenSessionValidationHandler.ValidateAsync(
                principal,
                validator.Object,
                NullLoggerFactory.Instance);

        Assert.False(outcome.Succeeded);
        Assert.True(outcome.SetSessionRevokedHeader);
        Assert.Equal("Session has been revoked or is no longer valid.", outcome.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_WhenSessionValid_Succeeds()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ClaimsPrincipal principal = CreatePrincipal(
            nameIdentifier: userId.ToString(),
            sessionId: sessionId.ToString());

        Mock<IAccessTokenSessionValidator> validator = new();
        validator
            .Setup(v => v.ValidateAsync(
                userId,
                "stamp",
                sessionId.ToString(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        AccessTokenSessionValidationHandler.ValidationOutcome outcome =
            await AccessTokenSessionValidationHandler.ValidateAsync(
                principal,
                validator.Object,
                NullLoggerFactory.Instance);

        Assert.True(outcome.Succeeded);
        Assert.False(outcome.SetSessionRevokedHeader);
        Assert.Null(outcome.FailureMessage);
    }
}
