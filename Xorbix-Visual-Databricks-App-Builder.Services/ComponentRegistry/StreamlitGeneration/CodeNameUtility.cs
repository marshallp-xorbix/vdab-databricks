using System.Text.RegularExpressions;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

public static class CodeNameUtility
{
    private static readonly Regex PythonIdentifierRegex = new("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

    public static bool IsValidPythonIdentifier(string codeName)
    {
        return !string.IsNullOrWhiteSpace(codeName) && PythonIdentifierRegex.IsMatch(codeName);
    }

    public static string ResolveVariableName(VdabComponentDto component)
    {
        string? codeName = component.CodeName?.Trim();
        if (!string.IsNullOrWhiteSpace(codeName) && IsValidPythonIdentifier(codeName))
        {
            return codeName;
        }

        throw new InvalidOperationException($"Component '{component.Id}' is missing a valid required codeName.");
    }
}
