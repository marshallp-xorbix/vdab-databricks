namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Why an account was retired (<see cref="EF.ApplicationUser.DeletedOn"/> set).
/// Null on live accounts.
/// </summary>
public enum AccountRetirementReason
{
    /// <summary>The account holder closed their own account.</summary>
    SelfService = 0,

    /// <summary>Xorbix platform (or a platform admin) closed the account.</summary>
    Platform = 1,
}
