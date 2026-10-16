namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Shared enum-string normalization for story visualConfig props.
/// </summary>
internal static class StoryEnumNormalizer
{
    /// <summary>
    /// Trims and lowercases <paramref name="value"/>; returns <paramref name="defaultValue"/>
    /// when null/empty or not in <paramref name="allowed"/>.
    /// </summary>
    public static string Normalize(string? value, string defaultValue, params string[] allowed)
    {
        string normalized = (value ?? defaultValue).Trim().ToLowerInvariant();
        foreach (string option in allowed)
        {
            if (string.Equals(normalized, option, StringComparison.Ordinal))
            {
                return option;
            }
        }

        return defaultValue;
    }
}
