using FluentResults;
using System.Text.RegularExpressions;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed partial class BuildSqlActionDefinition : WorkflowActionDefinitionBase<BuildSqlActionModel>
{
    [GeneratedRegex(@"\{([A-Za-z_][A-Za-z0-9_]*)\}")]
    private static partial Regex BuildSqlTokenPattern();

    public BuildSqlActionDefinition()
        : base(WorkflowActionKind.BuildSql)
    {
    }

    protected override Result ValidateTyped(BuildSqlActionModel actionNode, WorkflowActionValidationContext context)
    {
        if (!Enum.IsDefined(actionNode.SqlSourceKind))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' has unsupported sqlSourceKind '{actionNode.SqlSourceKind}'."));
        }

        if (string.IsNullOrWhiteSpace(actionNode.SqlTemplate))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a SQL template."));
        }

        List<string> parsedTokens = ParseTokens(actionNode.SqlTemplate);
        Dictionary<string, BuildSqlPlaceholderReference> placeholdersByToken = new(StringComparer.Ordinal);

        foreach (BuildSqlPlaceholderReference placeholder in actionNode.Placeholders)
        {
            if (string.IsNullOrWhiteSpace(placeholder.Token))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' contains a BuildSql placeholder with a missing token."));
            }

            if (!placeholdersByToken.TryAdd(placeholder.Token, placeholder))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' contains duplicate placeholder metadata for token '{placeholder.Token}'."));
            }

            if (string.IsNullOrWhiteSpace(placeholder.ComponentCodeName) ||
                !context.ComponentsByCodeName.ContainsKey(placeholder.ComponentCodeName))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' references unknown placeholder component '{placeholder.ComponentCodeName}'."));
            }

            if (!Enum.IsDefined(placeholder.ValueType))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' has unsupported placeholder valueType '{placeholder.ValueType}'."));
            }

            if (placeholder.FormatHint.HasValue && !Enum.IsDefined(placeholder.FormatHint.Value))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' has unsupported placeholder formatHint '{placeholder.FormatHint.Value}'."));
            }
        }

        foreach (string parsedToken in parsedTokens)
        {
            if (!placeholdersByToken.ContainsKey(parsedToken))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' is missing placeholder metadata for token '{parsedToken}'."));
            }
        }

        foreach (string placeholderToken in placeholdersByToken.Keys)
        {
            if (!parsedTokens.Contains(placeholderToken, StringComparer.Ordinal))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' has placeholder metadata for token '{placeholderToken}' that is not present in the SQL template."));
            }
        }

        if (actionNode.SqlSourceKind == WorkflowSqlSourceKind.UnityCatalogTable)
        {
            if (!string.IsNullOrWhiteSpace(actionNode.LakebaseAppResourceName) ||
                !string.IsNullOrWhiteSpace(actionNode.LakebaseDatabaseName))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' must not set Lakebase app resource fields when sqlSourceKind is Unity Catalog."));
            }

            return Result.Ok();
        }

        if (actionNode.SqlSourceKind == WorkflowSqlSourceKind.LakebaseProvisionedDatabase ||
            actionNode.SqlSourceKind == WorkflowSqlSourceKind.LakebaseAutoscaling)
        {
            if (string.IsNullOrWhiteSpace(actionNode.LakebaseAppResourceName))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a Lakebase app resource for the selected SQL source."));
            }

            if (string.IsNullOrWhiteSpace(actionNode.LakebaseDatabaseName))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a Lakebase database name for the selected app resource."));
            }

            if (context.NormalizedAppResources != null)
            {
                string expectedKind = actionNode.SqlSourceKind == WorkflowSqlSourceKind.LakebaseProvisionedDatabase
                    ? DatabricksAppResourceKinds.Database
                    : DatabricksAppResourceKinds.AutoscalingDatabase;

                NormalizedAppResourceDto? match = context.NormalizedAppResources.FirstOrDefault(resource =>
                    string.Equals(resource.Name, actionNode.LakebaseAppResourceName, StringComparison.OrdinalIgnoreCase));

                if (match == null)
                {
                    return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' references unknown app resource '{actionNode.LakebaseAppResourceName}'. Add or fix the resource in App Settings."));
                }

                if (!string.Equals(match.Kind, expectedKind, StringComparison.OrdinalIgnoreCase))
                {
                    return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' app resource '{actionNode.LakebaseAppResourceName}' must be kind '{expectedKind}' for sqlSourceKind '{actionNode.SqlSourceKind}'."));
                }

                string resourceDatabaseName = match.Database?.DatabaseName?.Trim() ?? string.Empty;
                if (resourceDatabaseName.Length > 0 &&
                    !string.Equals(resourceDatabaseName, actionNode.LakebaseDatabaseName, StringComparison.OrdinalIgnoreCase))
                {
                    return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' database name '{actionNode.LakebaseDatabaseName}' does not match app resource '{actionNode.LakebaseAppResourceName}' (expected '{resourceDatabaseName}')."));
                }
            }

            return Result.Ok();
        }

        return Result.Ok();
    }

    private static List<string> ParseTokens(string sqlTemplate)
    {
        List<string> tokens = new();
        HashSet<string> seenTokens = new(StringComparer.Ordinal);

        foreach (Match match in BuildSqlTokenPattern().Matches(sqlTemplate))
        {
            string token = match.Groups[1].Value;
            if (string.IsNullOrWhiteSpace(token) || !seenTokens.Add(token))
            {
                continue;
            }

            tokens.Add(token);
        }

        return tokens;
    }
}