using System.Text.RegularExpressions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

/// <summary>
/// Validates user-supplied Python function names for Call Custom Module actions.
/// </summary>
internal static class CustomModuleFunctionNameSyntax
{
    private static readonly Regex IdentifierPattern = new Regex(
        "^[A-Za-z][A-Za-z0-9_]*$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    /// <summary>
    /// Returns true when <paramref name="name"/> is a safe top-level identifier (no dunders, no attribute traversal).
    /// </summary>
    internal static bool IsValid(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return false;
        }

        string trimmed = name.Trim();
        if (trimmed.StartsWith("_", StringComparison.Ordinal))
        {
            return false;
        }

        if (trimmed.Contains("__", StringComparison.Ordinal))
        {
            return false;
        }

        return IdentifierPattern.IsMatch(trimmed);
    }
}
