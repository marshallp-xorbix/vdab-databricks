namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Shared naming helpers for import operations.
/// </summary>
internal static class ImportNaming
{
    private const string ImportedSuffix = " (imported)";

    /// <summary>
    /// Returns <paramref name="requestedName"/> if unused, otherwise appends an
    /// "(imported)" suffix, incrementing a counter until the name is unique.
    /// </summary>
    /// <param name="requestedName">The desired name.</param>
    /// <param name="existingNames">The set of names already in use (case-insensitive).</param>
    /// <returns>A name that does not collide with <paramref name="existingNames"/>.</returns>
    public static string ResolveUniqueName(string requestedName, HashSet<string> existingNames)
    {
        if (!existingNames.Contains(requestedName))
        {
            return requestedName;
        }

        string candidate = requestedName + ImportedSuffix;
        int counter = 2;
        while (existingNames.Contains(candidate))
        {
            candidate = $"{requestedName}{ImportedSuffix} {counter}";
            counter++;
        }

        return candidate;
    }
}
