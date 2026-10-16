namespace Xorbix_Visual_Databricks_App_Builder.Tests.DataAccess;

/// <summary>
/// A <see cref="FactAttribute"/> that skips the test unless a live-database connection string is supplied
/// via the <c>ConnectionStrings__PostgreSql</c> environment variable. This lets schema-validation tests live
/// in the normal suite while staying inert during CI runs that have no database to point at.
/// </summary>
public sealed class RequiresDatabaseSchemaFactAttribute : FactAttribute
{
    /// <summary>Environment variable holding the connection string to validate against.</summary>
    public const string ConnectionStringEnvironmentVariable = "ConnectionStrings__PostgreSql";

    /// <summary>Initializes the attribute, skipping the test when no connection string is configured.</summary>
    public RequiresDatabaseSchemaFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ConnectionStringEnvironmentVariable)))
        {
            Skip = $"Set the {ConnectionStringEnvironmentVariable} environment variable to validate the EF model "
                + "against a live database.";
        }
    }
}
