using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class AccountAccessPolicy : IAccountAccessPolicy
{
    /// <inheritdoc/>
    public bool CanAuthenticate(ApplicationUser? user) =>
        user is not null
        && user.IsActive
        && user.DeletedOn is null
        && user.AnonymizedOn is null;
}
