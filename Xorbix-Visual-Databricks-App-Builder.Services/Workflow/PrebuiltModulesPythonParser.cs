using FluentResults;
using System.Text.RegularExpressions;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

/// <summary>
/// Parses top-level <c>def</c> lines from <c>prebuilt_modules_library.py</c> for workflow metadata and validation.
/// </summary>
internal static class PrebuiltModulesPythonParser
{
    private static readonly Regex TopLevelDefPattern = new Regex(
        @"^def\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<args>[^)]*)\)\s*:",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>
    /// Returns ordered parameter names after the leading <c>ctx</c> parameter, or failure when the function is missing
    /// or does not follow prebuilt conventions (first param must be <c>ctx</c>; no <c>*</c>/<c>**</c> parameters).
    /// </summary>
    internal static Result<List<string>> TryGetWorkflowParameterNames(string source, string functionName)
    {
        if (string.IsNullOrWhiteSpace(functionName))
        {
            return Result.Fail<List<string>>(new ValidationError("functionName is required."));
        }

        string trimmedName = functionName.Trim();
        foreach (string rawLine in source.Split(["\r\n", "\n"], StringSplitOptions.None))
        {
            string line = rawLine.TrimStart();
            if (line.Length == 0 || line[0] == '#')
            {
                continue;
            }

            Match match = TopLevelDefPattern.Match(line);
            if (!match.Success)
            {
                continue;
            }

            if (!string.Equals(match.Groups["name"].Value, trimmedName, StringComparison.Ordinal))
            {
                continue;
            }

            string argsSection = match.Groups["args"].Value.Trim();
            List<string> rawParams = SplitTopLevelArgs(argsSection);
            if (rawParams.Count == 0)
            {
                return Result.Fail<List<string>>(new ValidationError($"Prebuilt function '{trimmedName}' must declare at least a ctx parameter."));
            }

            string? firstName = GetParameterName(rawParams[0]);
            if (!string.Equals(firstName, "ctx", StringComparison.Ordinal))
            {
                return Result.Fail<List<string>>(new ValidationError($"Prebuilt function '{trimmedName}' must use 'ctx' as its first parameter."));
            }

            List<string> afterCtx = new();
            for (int index = 1; index < rawParams.Count; index++)
            {
                string? paramName = GetParameterName(rawParams[index]);
                if (paramName == null)
                {
                    return Result.Fail<List<string>>(new ValidationError($"Prebuilt function '{trimmedName}' uses an unsupported parameter form in '{rawParams[index].Trim()}'."));
                }

                afterCtx.Add(paramName);
            }

            return Result.Ok(afterCtx);
        }

        return Result.Fail<List<string>>(new ValidationError($"Prebuilt function '{trimmedName}' was not found in prebuilt_modules_library.py."));
    }

    private static List<string> SplitTopLevelArgs(string argsSection)
    {
        if (string.IsNullOrWhiteSpace(argsSection))
        {
            return new List<string>();
        }

        List<string> parts = new();
        int depth = 0;
        int start = 0;
        for (int index = 0; index < argsSection.Length; index++)
        {
            char c = argsSection[index];
            if (c == '(' || c == '[' || c == '{')
            {
                depth++;
            }
            else if (c == ')' || c == ']' || c == '}')
            {
                depth = Math.Max(0, depth - 1);
            }
            else if (c == ',' && depth == 0)
            {
                parts.Add(argsSection.Substring(start, index - start));
                start = index + 1;
            }
        }

        parts.Add(argsSection.Substring(start));
        return parts;
    }

    private static string? GetParameterName(string segment)
    {
        string trimmed = segment.Trim();
        if (trimmed.Length == 0)
        {
            return null;
        }

        if (trimmed.StartsWith("*", StringComparison.Ordinal))
        {
            return null;
        }

        string head = trimmed;
        int equalsIndex = head.IndexOf('=');
        if (equalsIndex >= 0)
        {
            head = head[..equalsIndex].Trim();
        }

        int colonIndex = head.IndexOf(':');
        if (colonIndex >= 0)
        {
            head = head[..colonIndex].Trim();
        }

        int spaceIndex = head.IndexOf(' ');
        if (spaceIndex >= 0)
        {
            head = head[..spaceIndex].Trim();
        }

        if (head.Length == 0)
        {
            return null;
        }

        if (string.Equals(head, "self", StringComparison.Ordinal))
        {
            return null;
        }

        return head;
    }
}
