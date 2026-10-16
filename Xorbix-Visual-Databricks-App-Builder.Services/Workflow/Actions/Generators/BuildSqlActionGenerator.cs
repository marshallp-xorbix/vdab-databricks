using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;

public class BuildSqlActionGenerator : WorkflowActionGeneratorBase<BuildSqlActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.BuildSql;

    public override void AppendRuntimeExecution(StringBuilder sb, BuildSqlActionModel actionNode, WorkflowActionGenerationContext generationContext, VdabComponentDto? triggerComponent, List<VdabComponentDto> components, string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);
        sb.AppendLine($"{indentation}try:");
        sb.AppendLine($"{indentation}    rendered_sql = {WorkflowTemplateHelper.BuildPythonStringLiteral(actionNode.SqlTemplate)}");

        foreach (BuildSqlPlaceholderReference placeholder in actionNode.Placeholders)
        {
            AppendPlaceholderReplacement(sb, placeholder, indentation);
        }

        sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{");
        sb.AppendLine($"{indentation}        'status': 'success',");
        sb.AppendLine($"{indentation}        'output': {{");
        sb.AppendLine($"{indentation}            'sql': rendered_sql,");
        sb.AppendLine($"{indentation}            'sqlSourceKind': {WorkflowTemplateHelper.BuildPythonStringLiteral(GetSqlSourceKindValue(actionNode.SqlSourceKind))}");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'error': None");
        sb.AppendLine($"{indentation}    }}");
        sb.AppendLine($"{indentation}except Exception as e:");
        sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': str(e)}}");
    }

    private static void AppendPlaceholderReplacement(StringBuilder sb, BuildSqlPlaceholderReference placeholder, string indentation)
    {
        string tokenLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral($"{{{placeholder.Token}}}");
        string componentCodeNameLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(placeholder.ComponentCodeName);
        string valueTypeLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(GetWorkflowValueTypeValue(placeholder.ValueType));
        string formatHintLiteral = placeholder.FormatHint.HasValue
            ? WorkflowTemplateHelper.BuildPythonStringLiteral(GetFormatHintValue(placeholder.FormatHint.Value))
            : "None";

        sb.AppendLine($"{indentation}    placeholder_value = _get_vdab_component_value({componentCodeNameLiteral})");
        sb.AppendLine($"{indentation}    formatted_placeholder_value = _format_build_sql_placeholder(placeholder_value, {valueTypeLiteral}, {formatHintLiteral})");
        sb.AppendLine($"{indentation}    rendered_sql = rendered_sql.replace({tokenLiteral}, formatted_placeholder_value)");
    }

    private static string GetSqlSourceKindValue(WorkflowSqlSourceKind sqlSourceKind)
    {
        return sqlSourceKind switch
        {
            WorkflowSqlSourceKind.UnityCatalogTable => "unityCatalogTable",
            WorkflowSqlSourceKind.LakebaseProvisionedDatabase => "lakebaseProvisionedDatabase",
            WorkflowSqlSourceKind.LakebaseAutoscaling => "lakebaseAutoscaling",
            _ => throw new InvalidOperationException($"Unsupported BuildSql sqlSourceKind '{sqlSourceKind}'.")
        };
    }

    private static string GetWorkflowValueTypeValue(WorkflowValueType valueType)
    {
        return valueType switch
        {
            WorkflowValueType.String => "string",
            WorkflowValueType.Number => "number",
            WorkflowValueType.Boolean => "boolean",
            WorkflowValueType.Date => "date",
            WorkflowValueType.DateTime => "datetime",
            WorkflowValueType.Unknown => "unknown",
            _ => throw new InvalidOperationException($"Unsupported BuildSql placeholder valueType '{valueType}'.")
        };
    }

    private static string GetFormatHintValue(BuildSqlFormatHint formatHint)
    {
        return formatHint switch
        {
            BuildSqlFormatHint.Raw => "raw",
            BuildSqlFormatHint.SqlStringLiteral => "sqlStringLiteral",
            BuildSqlFormatHint.SqlIdentifier => "sqlIdentifier",
            BuildSqlFormatHint.DateLiteral => "dateLiteral",
            _ => throw new InvalidOperationException($"Unsupported BuildSql placeholder formatHint '{formatHint}'.")
        };
    }
}
