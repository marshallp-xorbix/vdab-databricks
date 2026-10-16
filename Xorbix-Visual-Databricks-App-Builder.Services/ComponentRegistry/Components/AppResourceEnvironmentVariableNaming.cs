using System.Text;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;

/// <summary>
/// Builds stable environment variable names from Databricks app resource keys.
/// </summary>
public static class AppResourceEnvironmentVariableNaming
{
    /// <summary>
    /// Builds an uppercase environment variable from a prefix and app resource key.
    /// </summary>
    public static string Build(string prefix, string resourceKey)
    {
        string suffix = ToEnvironmentSuffix(resourceKey);
        return $"{prefix}_{suffix}";
    }

    private static string ToEnvironmentSuffix(string resourceKey)
    {
        string trimmed = resourceKey.Trim();
        if (trimmed.Length == 0)
        {
            return "UNBOUND";
        }

        StringBuilder stringBuilder = new();
        bool lastUnderscore = false;
        foreach (char c in trimmed)
        {
            if (char.IsLetterOrDigit(c))
            {
                stringBuilder.Append(char.ToUpperInvariant(c));
                lastUnderscore = false;
                continue;
            }

            if (stringBuilder.Length > 0 && !lastUnderscore)
            {
                stringBuilder.Append('_');
                lastUnderscore = true;
            }
        }

        string result = stringBuilder.ToString().TrimEnd('_');
        return result.Length > 0 ? result : "RESOURCE";
    }
}
