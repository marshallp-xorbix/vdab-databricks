using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;

/// <summary>
/// Base class providing common utilities for component services
/// </summary>
public abstract class BaseComponentService : IComponentService
{
    /// <summary>
    /// Optional reference to generation service for components that need recursive generation
    /// Will be set by the StreamlitGenerationService for layout components
    /// </summary>
    protected IStreamlitGenerationService? GenerationService { get; set; }

    /// <inheritdoc/>
    public abstract ComponentType ComponentType { get; }

    /// <inheritdoc/>
    public abstract VdabComponentDto GetDefinition();

    /// <inheritdoc/>
    public abstract string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null);

    /// <summary>
    /// Sets the generation service for recursive code generation (used by layout components)
    /// </summary>
    /// <param name="generationService">The generation service instance</param>
    public void SetGenerationService(IStreamlitGenerationService generationService)
    {
        GenerationService = generationService;
    }

    /// <summary>
    /// Converts C# bool to Python bool string
    /// </summary>
    /// <param name="value">Boolean value to convert</param>
    /// <returns>"True" or "False" string for Python</returns>
    protected static string ToPythonBool(bool value) => value ? "True" : "False";

    /// <summary>
    /// Escapes a string for embedding inside a Python single-quoted literal.
    /// </summary>
    /// <param name="value">Raw string value</param>
    /// <returns>Escaped content without surrounding quotes</returns>
    protected static string EscapePythonSingleQuoted(string value) =>
        value
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("'", "\\'", StringComparison.Ordinal);

    /// <summary>
    /// Builds a Python double-quoted string literal (e.g. for URLs) with escapes for \, ", newlines, and non-printables.
    /// </summary>
    /// <param name="value">Raw string value</param>
    /// <returns>Python source fragment including surrounding double quotes</returns>
    protected static string ToPythonDoubleQuotedString(string value)
    {
        StringBuilder sb = new StringBuilder();
        sb.Append('"');
        foreach (char c in value)
        {
            switch (c)
            {
                case '\\':
                    sb.Append("\\\\");
                    break;
                case '"':
                    sb.Append("\\\"");
                    break;
                case '\n':
                    sb.Append("\\n");
                    break;
                case '\r':
                    sb.Append("\\r");
                    break;
                case '\t':
                    sb.Append("\\t");
                    break;
                default:
                    if (c < 32)
                    {
                        sb.AppendFormat("\\x{0:x2}", (int)c);
                    }
                    else
                    {
                        sb.Append(c);
                    }

                    break;
            }
        }

        sb.Append('"');
        return sb.ToString();
    }

    /// <summary>
    /// Generates a valid Python variable name from component codeName
    /// 
    /// </summary>
    /// <param name="component">Component to generate variable name for</param>
    /// <returns>Python-safe variable name</returns>
    protected static string GetVariableName(VdabComponentDto component)
    {
        return CodeNameUtility.ResolveVariableName(component);
    }

    /// <summary>
    /// Generates placeholder data for DataWindow or EditableDataWindow components
    /// </summary>
    /// <param name="sb">StringBuilder to append to</param>
    /// <param name="varName">Variable name for the data</param>
    /// <param name="indentation">Indentation string</param>
    protected static void AppendPlaceholderData(StringBuilder sb, string varName, string indentation)
    {
        sb.AppendLine($"{indentation}{varName}_data = pd.DataFrame({{");
        sb.AppendLine($"{indentation}    'Column 1': [1, 2, 3, 4, 5],");
        sb.AppendLine($"{indentation}    'Column 2': ['A', 'B', 'C', 'D', 'E']");
        sb.AppendLine($"{indentation}}})");
    }
}