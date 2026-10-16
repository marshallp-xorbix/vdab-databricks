using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Single source of truth for whether an account may authenticate on any path.
/// </summary>
public interface IAccountAccessPolicy
{
    /// <summary>
    /// Returns true when the account is eligible to authenticate (password, passwordless, or session).
    /// Retired (<see cref="ApplicationUser.DeletedOn"/>) and anonymized accounts are always denied,
    /// including the failed-rescue encoding where <see cref="ApplicationUser.IsActive"/> is true
    /// but <see cref="ApplicationUser.DeletedOn"/> is set.
    /// </summary>
    /// <param name="user">The user to evaluate; null is never authenticable.</param>
    /// <returns>True when the user may authenticate; otherwise false.</returns>
    bool CanAuthenticate(ApplicationUser? user);
}
