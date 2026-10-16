using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class PolicyConsentEvaluatorTests
{
    private static readonly DateOnly CurrentVersion = new(2026, 3, 16);

    [Fact]
    public void RequiresPolicyAcceptance_NullStoredVersion_ReturnsTrue()
    {
        bool result = PolicyConsentEvaluator.RequiresPolicyAcceptance(
            storedVersion: null,
            acceptedOnUtc: null,
            CurrentVersion);

        Assert.True(result);
    }

    [Fact]
    public void RequiresPolicyAcceptance_StoredVersionOlderThanCurrent_ReturnsTrue()
    {
        bool result = PolicyConsentEvaluator.RequiresPolicyAcceptance(
            storedVersion: new DateOnly(2016, 3, 16),
            acceptedOnUtc: new DateTime(2016, 3, 16, 12, 0, 0, DateTimeKind.Utc),
            CurrentVersion);

        Assert.True(result);
    }

    [Fact]
    public void RequiresPolicyAcceptance_MatchingVersionWithStaleAcceptedOn_ReturnsTrue()
    {
        bool result = PolicyConsentEvaluator.RequiresPolicyAcceptance(
            storedVersion: CurrentVersion,
            acceptedOnUtc: new DateTime(2016, 3, 16, 12, 0, 0, DateTimeKind.Utc),
            CurrentVersion);

        Assert.True(result);
    }

    [Fact]
    public void RequiresPolicyAcceptance_MatchingVersionWithValidAcceptedOn_ReturnsFalse()
    {
        bool result = PolicyConsentEvaluator.RequiresPolicyAcceptance(
            storedVersion: CurrentVersion,
            acceptedOnUtc: new DateTime(2026, 3, 20, 12, 0, 0, DateTimeKind.Utc),
            CurrentVersion);

        Assert.False(result);
    }

    [Fact]
    public void RequiresPolicyAcceptance_MatchingVersionWithAcceptedOnOnVersionDate_ReturnsFalse()
    {
        bool result = PolicyConsentEvaluator.RequiresPolicyAcceptance(
            storedVersion: CurrentVersion,
            acceptedOnUtc: new DateTime(2026, 3, 16, 0, 0, 0, DateTimeKind.Utc),
            CurrentVersion);

        Assert.False(result);
    }

    [Fact]
    public void RequiresPolicyAcceptance_MatchingVersionWithMissingAcceptedOn_ReturnsTrue()
    {
        bool result = PolicyConsentEvaluator.RequiresPolicyAcceptance(
            storedVersion: CurrentVersion,
            acceptedOnUtc: null,
            CurrentVersion);

        Assert.True(result);
    }

    [Fact]
    public void RequiresTermsOfServiceAcceptance_DelegatesToSharedLogic()
    {
        bool result = PolicyConsentEvaluator.RequiresTermsOfServiceAcceptance(
            storedVersion: null,
            acceptedOnUtc: null,
            CurrentVersion);

        Assert.True(result);
    }

    [Fact]
    public void RequiresPrivacyPolicyAcceptance_DelegatesToSharedLogic()
    {
        bool result = PolicyConsentEvaluator.RequiresPrivacyPolicyAcceptance(
            storedVersion: null,
            acceptedOnUtc: null,
            CurrentVersion);

        Assert.True(result);
    }
}
