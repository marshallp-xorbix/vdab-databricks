using System.Text.RegularExpressions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

internal sealed record AiBuilderModuleFunction(
    string FunctionName,
    string Signature,
    List<string> ParameterNames);

internal static class AiBuilderModuleFunctionParser
{
    private static readonly Regex TopLevelDefPattern = new(
        @"^def\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<args>[^)]*)\)\s*:",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    internal static List<AiBuilderModuleFunction> ParseCustomFunctions(string source)
    {
        return ParseFunctions(source, requireCtxFirst: false)
            .Where(function => CustomModuleFunctionNameSyntax.IsValid(function.FunctionName))
            .ToList();
    }

    internal static List<AiBuilderModuleFunction> ParseCallableCustomFunctions(string source)
    {
        return ParseCustomFunctions(source)
            .Where(function => function.ParameterNames.Count > 0 && string.Equals(function.ParameterNames[0], "ctx", StringComparison.Ordinal))
            .ToList();
    }

    internal static List<AiBuilderModuleFunction> ParsePrebuiltFunctions(string source)
    {
        return ParseFunctions(source, requireCtxFirst: true)
            .Where(function => CustomModuleFunctionNameSyntax.IsValid(function.FunctionName))
            .ToList();
    }

    private static List<AiBuilderModuleFunction> ParseFunctions(string source, bool requireCtxFirst)
    {
        List<AiBuilderModuleFunction> functions = [];
        HashSet<string> seen = new(StringComparer.Ordinal);
        foreach (string rawLine in source.Split(["\r\n", "\n"], StringSplitOptions.None))
        {
            string line = rawLine.TrimStart();
            if (line.Length == 0 || line[0] == '#')
                continue;

            Match match = TopLevelDefPattern.Match(line);
            if (!match.Success)
                continue;

            string functionName = match.Groups["name"].Value;
            if (!seen.Add(functionName))
                continue;

            string argsSection = match.Groups["args"].Value.Trim();
            List<string> parameterNames = SplitTopLevelArgs(argsSection)
                .Select(GetParameterName)
                .Where(parameterName => parameterName is not null)
                .Select(parameterName => parameterName!)
                .ToList();

            if (requireCtxFirst && (parameterNames.Count == 0 || !string.Equals(parameterNames[0], "ctx", StringComparison.Ordinal)))
                continue;

            functions.Add(new AiBuilderModuleFunction(functionName, $"{functionName}({argsSection})", parameterNames));
        }

        return functions;
    }

    private static List<string> SplitTopLevelArgs(string argsSection)
    {
        if (string.IsNullOrWhiteSpace(argsSection))
            return [];

        List<string> parts = [];
        int depth = 0;
        int start = 0;
        for (int index = 0; index < argsSection.Length; index++)
        {
            char c = argsSection[index];
            if (c == '(' || c == '[' || c == '{')
                depth++;
            else if (c == ')' || c == ']' || c == '}')
                depth = Math.Max(0, depth - 1);
            else if (c == ',' && depth == 0)
            {
                parts.Add(argsSection[start..index]);
                start = index + 1;
            }
        }

        parts.Add(argsSection[start..]);
        return parts;
    }

    private static string? GetParameterName(string segment)
    {
        string trimmed = segment.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith("*", StringComparison.Ordinal))
            return null;

        string head = trimmed;
        int equalsIndex = head.IndexOf('=');
        if (equalsIndex >= 0)
            head = head[..equalsIndex].Trim();

        int colonIndex = head.IndexOf(':');
        if (colonIndex >= 0)
            head = head[..colonIndex].Trim();

        int spaceIndex = head.IndexOf(' ');
        if (spaceIndex >= 0)
            head = head[..spaceIndex].Trim();

        if (head.Length == 0 || string.Equals(head, "self", StringComparison.Ordinal))
            return null;

        return head;
    }
}
