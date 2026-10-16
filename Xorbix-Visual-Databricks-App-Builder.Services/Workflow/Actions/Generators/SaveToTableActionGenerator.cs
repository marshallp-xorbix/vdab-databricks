using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;

public class SaveToTableActionGenerator : WorkflowActionGeneratorBase<SaveToTableActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.SaveToTable;

    public override void AppendRuntimeExecution(StringBuilder sb, SaveToTableActionModel actionNode, WorkflowActionGenerationContext generationContext, VdabComponentDto? triggerComponent, List<VdabComponentDto> components, string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);
        if (triggerComponent == null ||
            triggerComponent.Type != ComponentType.Form ||
            !string.Equals(triggerComponent.CodeName, actionNode.SourceFormComponentCodeName, StringComparison.OrdinalIgnoreCase) ||
            !TryResolveSaveTableTarget(actionNode.TargetTable, out ResolvedSaveTableTarget? resolvedTarget))
        {
            sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': 'SaveToTable requires the typed source form trigger and a valid target table.'}}");
            return;
        }

        ResolvedSaveTableTarget tableTarget = resolvedTarget!;
        if (!IsValidSqlIdentifierPath(tableTarget.TableReference))
        {
            sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': 'SaveToTable target table contains an invalid SQL identifier.'}}");
            return;
        }

        foreach (SaveToTableColumnMapping columnMapping in actionNode.ColumnMappings)
        {
            if (!IsValidSqlIdentifierSegment(columnMapping.TargetColumnName))
            {
                sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': 'SaveToTable target columns must be valid SQL identifiers.'}}");
                return;
            }
        }

        IReadOnlyDictionary<string, string> formInputKeysByCodeName = GetFormInputKeysByCodeName(triggerComponent, components);
        string targetTableReferenceLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(tableTarget.TableReference);
        string executionCall = tableTarget.UsesLakebase
            ? "lakebase_execute_sql(insert_sql)"
            : "sql_execute(insert_sql)";

        sb.AppendLine($"{indentation}try:");
        sb.AppendLine($"{indentation}    source_form_values = {{");
        foreach (KeyValuePair<string, string> formInput in formInputKeysByCodeName)
        {
            sb.AppendLine($"{indentation}        {WorkflowTemplateHelper.BuildPythonStringLiteral(formInput.Key)}: st.session_state.get({WorkflowTemplateHelper.BuildPythonStringLiteral(formInput.Value)}),");
        }
        sb.AppendLine($"{indentation}    }}");
        sb.AppendLine($"{indentation}    resolved_column_mappings = [");
        foreach (SaveToTableColumnMapping columnMapping in actionNode.ColumnMappings)
        {
            sb.AppendLine($"{indentation}        {{'formChildComponentCodeName': {WorkflowTemplateHelper.BuildPythonStringLiteral(columnMapping.FormChildComponentCodeName)}, 'targetColumnName': {WorkflowTemplateHelper.BuildPythonStringLiteral(columnMapping.TargetColumnName)}, 'value': source_form_values.get({WorkflowTemplateHelper.BuildPythonStringLiteral(columnMapping.FormChildComponentCodeName)})}},");
        }
        sb.AppendLine($"{indentation}    ]");
        sb.AppendLine($"{indentation}    if not resolved_column_mappings:");
        sb.AppendLine($"{indentation}        raise ValueError('SaveToTable requires at least one explicit column mapping.')");
        sb.AppendLine($"{indentation}    seen_target_columns = set()");
        sb.AppendLine($"{indentation}    mapped_values = {{}}");
        sb.AppendLine($"{indentation}    for mapping in resolved_column_mappings:");
        sb.AppendLine($"{indentation}        normalized_column_name = str(mapping['targetColumnName']).lower()");
        sb.AppendLine($"{indentation}        if normalized_column_name in seen_target_columns:");
        sb.AppendLine($"{indentation}            duplicate_target_column_name = mapping['targetColumnName']");
        sb.AppendLine($"{indentation}            raise ValueError(f\"SaveToTable has duplicate target column mapping '{{duplicate_target_column_name}}'.\")");
        sb.AppendLine($"{indentation}        seen_target_columns.add(normalized_column_name)");
        sb.AppendLine($"{indentation}        mapped_values[mapping['targetColumnName']] = mapping['value']");
        sb.AppendLine($"{indentation}    column_sql = ', '.join(_format_build_sql_identifier(mapping['targetColumnName']) for mapping in resolved_column_mappings)");
        sb.AppendLine($"{indentation}    value_sql = ', '.join(_format_save_to_table_value(mapping['value']) for mapping in resolved_column_mappings)");
        sb.AppendLine($"{indentation}    insert_sql = f\"INSERT INTO {tableTarget.TableReference} ({{column_sql}}) VALUES ({{value_sql}})\"");

        sb.AppendLine($"{indentation}    {executionCall}");
        sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{");
        sb.AppendLine($"{indentation}        'status': 'success',");
        sb.AppendLine($"{indentation}        'output': {{");
        sb.AppendLine($"{indentation}            'sourceFormComponentCodeName': {WorkflowTemplateHelper.BuildPythonStringLiteral(actionNode.SourceFormComponentCodeName)},");
        sb.AppendLine($"{indentation}            'targetTable': {BuildTargetTableLiteral(actionNode.TargetTable)},");
        sb.AppendLine($"{indentation}            'targetTableReference': {targetTableReferenceLiteral},");
        sb.AppendLine($"{indentation}            'excludedColumns': {BuildExcludedColumnsLiteral(actionNode.ExcludedColumns)},");
        sb.AppendLine($"{indentation}            'columnMappings': resolved_column_mappings,");
        sb.AppendLine($"{indentation}            'sourceFormValues': source_form_values,");
        sb.AppendLine($"{indentation}            'mappedValues': mapped_values,");
        sb.AppendLine($"{indentation}            'statement': insert_sql,");
        sb.AppendLine($"{indentation}            'rowsAffected': 1,");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'error': None");
        sb.AppendLine($"{indentation}    }}");
        sb.AppendLine($"{indentation}except Exception as e:");
        sb.AppendLine($"{indentation}    error_message = f\"SaveToTable failed for {tableTarget.TableReference}: {{type(e).__name__}}: {{str(e)}}\"");
        sb.AppendLine($"{indentation}    st.toast(error_message, icon=':material/error:')");
        sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': error_message}}");
    }

    private static bool IsValidSqlIdentifierPath(string value)
    {
        string[] parts = value.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
        {
            return false;
        }

        foreach (string part in parts)
        {
            if (!IsValidSqlIdentifierSegment(part))
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsValidSqlIdentifierSegment(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        if (!(char.IsLetter(value[0]) || value[0] == '_'))
        {
            return false;
        }

        for (int index = 1; index < value.Length; index++)
        {
            char character = value[index];
            if (!(char.IsLetterOrDigit(character) || character == '_'))
            {
                return false;
            }
        }

        return true;
    }

    private static string BuildTargetTableLiteral(SaveTargetTableRef targetTable)
    {
        List<string> properties = new()
        {
            $"'workspaceConnectionId': {WorkflowTemplateHelper.BuildPythonLiteral(targetTable.WorkspaceConnectionId)}",
            $"'tableType': {WorkflowTemplateHelper.BuildPythonStringLiteral(targetTable.TableType)}",
            $"'catalog': {WorkflowTemplateHelper.BuildPythonStringLiteral(targetTable.Catalog)}",
            $"'schema': {WorkflowTemplateHelper.BuildPythonStringLiteral(targetTable.Schema)}",
            $"'table': {WorkflowTemplateHelper.BuildPythonStringLiteral(targetTable.Table)}",
        };

        if (targetTable is LakebaseTableRef lakebaseTarget)
        {
            properties.Add($"'instanceName': {WorkflowTemplateHelper.BuildPythonStringLiteral(lakebaseTarget.InstanceName)}");
            properties.Add($"'database': {WorkflowTemplateHelper.BuildPythonStringLiteral(lakebaseTarget.Database)}");
        }

        if (targetTable is LakebaseAutoscalingTableRef autoscalingTarget)
        {
            properties.Add($"'projectId': {WorkflowTemplateHelper.BuildPythonStringLiteral(autoscalingTarget.ProjectId)}");
            properties.Add($"'branchId': {WorkflowTemplateHelper.BuildPythonStringLiteral(autoscalingTarget.BranchId)}");
            properties.Add($"'endpointId': {WorkflowTemplateHelper.BuildPythonStringLiteral(autoscalingTarget.EndpointId)}");
            properties.Add($"'database': {WorkflowTemplateHelper.BuildPythonStringLiteral(autoscalingTarget.Database)}");
        }

        return $"{{{string.Join(", ", properties)}}}";
    }

    private static string BuildExcludedColumnsLiteral(IEnumerable<SaveToTableColumnOverride> excludedColumns)
    {
        List<string> excludedColumnLiterals = new();
        foreach (SaveToTableColumnOverride excludedColumn in excludedColumns)
        {
            excludedColumnLiterals.Add(
                $"{{'columnName': {WorkflowTemplateHelper.BuildPythonStringLiteral(excludedColumn.ColumnName)}, 'reason': {WorkflowTemplateHelper.BuildPythonStringLiteral(GetOverrideReasonValue(excludedColumn.Reason))}}}");
        }

        return $"[{string.Join(", ", excludedColumnLiterals)}]";
    }

    private static string GetOverrideReasonValue(SaveToTableColumnOverrideReason reason)
    {
        return reason switch
        {
            SaveToTableColumnOverrideReason.Autogenerated => "autogenerated",
            SaveToTableColumnOverrideReason.SystemManaged => "systemManaged",
            SaveToTableColumnOverrideReason.ManualSkip => "manualSkip",
            _ => throw new InvalidOperationException($"Unsupported SaveToTable excluded column reason '{reason}'."),
        };
    }

    public static bool TryResolveSaveTableTarget(
        SaveTargetTableRef targetTable,
        out ResolvedSaveTableTarget? resolvedTarget)
    {
        resolvedTarget = null;
        if (targetTable == null)
        {
            return false;
        }

        if (targetTable is LakebaseTableRef lakebaseTarget)
        {
            if (string.IsNullOrWhiteSpace(lakebaseTarget.Database) ||
                string.IsNullOrWhiteSpace(lakebaseTarget.Schema) ||
                string.IsNullOrWhiteSpace(lakebaseTarget.Table))
            {
                return false;
            }

            resolvedTarget = new ResolvedSaveTableTarget(lakebaseTarget.Database, lakebaseTarget.Schema, lakebaseTarget.Table, true);
            return true;
        }

        if (targetTable is LakebaseAutoscalingTableRef autoscalingTarget)
        {
            if (string.IsNullOrWhiteSpace(autoscalingTarget.Database) ||
                string.IsNullOrWhiteSpace(autoscalingTarget.Schema) ||
                string.IsNullOrWhiteSpace(autoscalingTarget.Table))
            {
                return false;
            }

            resolvedTarget = new ResolvedSaveTableTarget(autoscalingTarget.Database, autoscalingTarget.Schema, autoscalingTarget.Table, true);
            return true;
        }

        if (targetTable is UnityCatalogTableRef unityCatalogTarget)
        {
            if (string.IsNullOrWhiteSpace(unityCatalogTarget.Catalog) ||
                string.IsNullOrWhiteSpace(unityCatalogTarget.Schema) ||
                string.IsNullOrWhiteSpace(unityCatalogTarget.Table))
            {
                return false;
            }

            resolvedTarget = new ResolvedSaveTableTarget(unityCatalogTarget.Catalog, unityCatalogTarget.Schema, unityCatalogTarget.Table, false);
            return true;
        }

        return false;
    }

    private static IReadOnlyDictionary<string, string> GetFormInputKeysByCodeName(
        VdabComponentDto triggerComponent,
        List<VdabComponentDto> components)
    {
        Dictionary<string, VdabComponentDto> componentsById = components.ToDictionary(component => component.Id, StringComparer.Ordinal);
        Dictionary<string, string> formInputKeysByCodeName = new(StringComparer.OrdinalIgnoreCase);

        if (triggerComponent.Children == null)
        {
            return formInputKeysByCodeName;
        }

        foreach (string childId in triggerComponent.Children)
        {
            CollectFormInputKeysByCodeName(childId, componentsById, formInputKeysByCodeName);
        }

        return formInputKeysByCodeName;
    }

    private static void CollectFormInputKeysByCodeName(
        string componentId,
        IReadOnlyDictionary<string, VdabComponentDto> componentsById,
        IDictionary<string, string> formInputKeysByCodeName)
    {
        if (!componentsById.TryGetValue(componentId, out VdabComponentDto? component))
        {
            return;
        }

        if (IsSaveToTableInputType(component.Type))
        {
            string codeName = CodeNameUtility.ResolveVariableName(component);
            formInputKeysByCodeName[component.CodeName!] = codeName;
        }

        if (component.Children == null)
        {
            return;
        }

        foreach (string childId in component.Children)
        {
            CollectFormInputKeysByCodeName(childId, componentsById, formInputKeysByCodeName);
        }
    }

    private static bool IsSaveToTableInputType(ComponentType componentType)
    {
        return componentType == ComponentType.TextInput ||
               componentType == ComponentType.Checkbox ||
               componentType == ComponentType.Toggle ||
               componentType == ComponentType.Dropdown ||
               componentType == ComponentType.DatePicker ||
               componentType == ComponentType.TimePicker ||
                             componentType == ComponentType.Slider;
    }

    public sealed class ResolvedSaveTableTarget
    {
        public ResolvedSaveTableTarget(string catalog, string schema, string table, bool usesLakebase)
        {
            Catalog = catalog;
            Schema = schema;
            Table = table;
            UsesLakebase = usesLakebase;
        }

        public string Catalog { get; }

        public string Schema { get; }

        public string Table { get; }

        public bool UsesLakebase { get; }

        public string TableReference => UsesLakebase
            ? $"{Schema}.{Table}"
            : $"{Catalog}.{Schema}.{Table}";
    }
}
