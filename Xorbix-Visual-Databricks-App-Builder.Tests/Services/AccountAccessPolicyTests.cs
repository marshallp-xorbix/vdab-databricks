using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Pins invariant 2: a row with DeletedOn set (or AnonymizedOn / Suspended) can never authenticate.
/// </summary>
public class AccountAccessPolicyTests
{
    private readonly AccountAccessPolicy _policy = new();

    [Fact]
    public void CanAuthenticate_ActiveUser_ReturnsTrue()
    {
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            IsActive = true,
            DeletedOn = null,
            AnonymizedOn = null,
        };

        Assert.True(_policy.CanAuthenticate(user));
    }

    [Fact]
    public void CanAuthenticate_NullUser_ReturnsFalse()
    {
        Assert.False(_policy.CanAuthenticate(null));
    }

    [Fact]
    public void CanAuthenticate_Suspended_IsActiveFalseDeletedOnNull_ReturnsFalse()
    {
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            IsActive = false,
            DeletedOn = null,
            AnonymizedOn = null,
        };

        Assert.False(_policy.CanAuthenticate(user));
    }

    [Fact]
    public void CanAuthenticate_Retired_DeletedOnSet_ReturnsFalse()
    {
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            IsActive = false,
            DeletedOn = DateTime.UtcNow,
            AnonymizedOn = null,
        };

        Assert.False(_policy.CanAuthenticate(user));
    }

    [Fact]
    public void CanAuthenticate_FailedRescueEncoding_IsActiveTrueDeletedOnSet_ReturnsFalse()
    {
        // §2.1 failed rescue: IsActive true but DeletedOn still set — must never authenticate.
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            IsActive = true,
            DeletedOn = DateTime.UtcNow,
            AnonymizedOn = null,
        };

        Assert.False(_policy.CanAuthenticate(user));
    }

    [Fact]
    public void CanAuthenticate_Anonymized_ReturnsFalse()
    {
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            IsActive = true,
            DeletedOn = null,
            AnonymizedOn = DateTime.UtcNow,
        };

        Assert.False(_policy.CanAuthenticate(user));
    }
}
