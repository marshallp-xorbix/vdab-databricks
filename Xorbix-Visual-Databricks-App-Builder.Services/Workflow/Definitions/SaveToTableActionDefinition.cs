using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed class SaveToTableActionDefinition : WorkflowActionDefinitionBase<SaveToTableActionModel>
{
    private static readonly HashSet<ComponentType> SupportedSourceComponentTypes = new()
    {
        ComponentType.TextInput,
        ComponentType.Checkbox,
        ComponentType.Toggle,
        ComponentType.Dropdown,
        ComponentType.DatePicker,
        ComponentType.TimePicker,
        ComponentType.Slider,
        ComponentType.FileUpload,
    };

    public SaveToTableActionDefinition()
        : base(WorkflowActionKind.SaveToTable)
    {
    }

    protected override Result ValidateTyped(SaveToTableActionModel actionNode, WorkflowActionValidationContext context)
    {
        Result<VdabComponentDto> triggerComponentResult = GetTriggerComponent(context);
        if (triggerComponentResult.IsFailed)
        {
            return Result.Fail(triggerComponentResult.Errors);
        }

        VdabComponentDto triggerComponent = triggerComponentResult.Value;
        if (triggerComponent.Type != ComponentType.Form)
        {
            return Result.Fail(new ValidationError(
                $"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' uses SaveToTable, but trigger component '{triggerComponent.CodeName}' is not a Form."));
        }

        if (!string.Equals(actionNode.SourceFormComponentCodeName, triggerComponent.CodeName, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Fail(new ValidationError(
                $"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' must use trigger form '{triggerComponent.CodeName}' as its source form."));
        }

        Result targetTableResult = ValidateTargetTable(actionNode, context.Workflow.CodeName);
        if (targetTableResult.IsFailed)
        {
            return targetTableResult;
        }

        HashSet<string> validFormFieldCodeNames = GetValidFormFieldCodeNames(triggerComponent, context.ComponentsById);
        foreach (SaveToTableColumnMapping mapping in actionNode.ColumnMappings)
        {
            if (!validFormFieldCodeNames.Contains(mapping.FormChildComponentCodeName))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' maps invalid form child '{mapping.FormChildComponentCodeName}'."));
            }
        }

        HashSet<string>? availableTargetColumns = GetAvailableTargetColumns(actionNode.TargetTable, context.ComponentsById.Values);
        if (availableTargetColumns != null)
        {
            foreach (SaveToTableColumnMapping mapping in actionNode.ColumnMappings)
            {
                if (!availableTargetColumns.Contains(mapping.TargetColumnName))
                {
                    return Result.Fail(new ValidationError(
                        $"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' maps unknown target column '{mapping.TargetColumnName}'."));
                }
            }
        }

        return Result.Ok();
    }

    private static Result<VdabComponentDto> GetTriggerComponent(WorkflowActionValidationContext context)
    {
        if (!context.ComponentsByCodeName.TryGetValue(context.Workflow.Trigger.ComponentCodeName, out VdabComponentDto? triggerComponent))
        {
            return Result.Fail<VdabComponentDto>(new ValidationError(
                $"Workflow '{context.Workflow.CodeName}' references missing trigger component '{context.Workflow.Trigger.ComponentCodeName}'."));
        }

        return Result.Ok(triggerComponent);
    }

    private static Result ValidateTargetTable(SaveToTableActionModel actionNode, string workflowCodeName)
    {
        if (actionNode.TargetTable == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{workflowCodeName}' node '{actionNode.Id}' requires a target table reference."));
        }

        if (actionNode.TargetTable.WorkspaceConnectionId <= 0)
        {
            return Result.Fail(new ValidationError($"Workflow '{workflowCodeName}' node '{actionNode.Id}' requires a workspace connection for SaveToTable."));
        }

        if (string.IsNullOrWhiteSpace(actionNode.TargetTable.Catalog) ||
            string.IsNullOrWhiteSpace(actionNode.TargetTable.Schema) ||
            string.IsNullOrWhiteSpace(actionNode.TargetTable.Table))
        {
            return Result.Fail(new ValidationError(
                $"Workflow '{workflowCodeName}' node '{actionNode.Id}' requires catalog, schema, and table values for SaveToTable."));
        }

        if (actionNode.TargetTable is UnityCatalogTableRef)
        {
            return Result.Ok();
        }

        if (actionNode.TargetTable is LakebaseTableRef lakebaseTarget)
        {
            if (string.IsNullOrWhiteSpace(lakebaseTarget.InstanceName) || string.IsNullOrWhiteSpace(lakebaseTarget.Database))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{workflowCodeName}' node '{actionNode.Id}' requires instanceName and database for a Lakebase SaveToTable target."));
            }

            return Result.Ok();
        }

        if (actionNode.TargetTable is LakebaseAutoscalingTableRef autoscalingTarget)
        {
            if (string.IsNullOrWhiteSpace(autoscalingTarget.ProjectId) ||
                string.IsNullOrWhiteSpace(autoscalingTarget.BranchId) ||
                string.IsNullOrWhiteSpace(autoscalingTarget.EndpointId) ||
                string.IsNullOrWhiteSpace(autoscalingTarget.Database))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{workflowCodeName}' node '{actionNode.Id}' requires projectId, branchId, endpointId, and database for a Lakebase Autoscaling SaveToTable target."));
            }

            return Result.Ok();
        }

        return Result.Fail(new ValidationError(
            $"Workflow '{workflowCodeName}' node '{actionNode.Id}' has unsupported SaveToTable target table type '{actionNode.TargetTable.TableType}'."));
    }

    private static HashSet<string> GetValidFormFieldCodeNames(
        VdabComponentDto triggerComponent,
        IReadOnlyDictionary<string, VdabComponentDto> componentsById)
    {
        HashSet<string> codeNames = new(StringComparer.OrdinalIgnoreCase);
        Stack<string> pendingComponentIds = new();

        if (triggerComponent.Children != null)
        {
            for (int index = triggerComponent.Children.Count - 1; index >= 0; index--)
            {
                pendingComponentIds.Push(triggerComponent.Children[index]);
            }
        }

        while (pendingComponentIds.Count > 0)
        {
            string componentId = pendingComponentIds.Pop();
            if (!componentsById.TryGetValue(componentId, out VdabComponentDto? component))
            {
                continue;
            }

            if (!string.IsNullOrWhiteSpace(component.CodeName) && SupportedSourceComponentTypes.Contains(component.Type))
            {
                codeNames.Add(component.CodeName);
            }

            if (component.Children == null)
            {
                continue;
            }

            for (int index = component.Children.Count - 1; index >= 0; index--)
            {
                pendingComponentIds.Push(component.Children[index]);
            }
        }

        return codeNames;
    }

    private static HashSet<string>? GetAvailableTargetColumns(
        SaveTargetTableRef targetTable,
        IEnumerable<VdabComponentDto> components)
    {
        foreach (VdabComponentDto component in components)
        {
            if (component.Bindings == null)
            {
                continue;
            }

            foreach (BindingDto binding in component.Bindings.Values)
            {
                ResourceBindingSourceDto? resource = binding.Source?.Resource;
                if (resource?.Columns == null || resource.Columns.Count == 0)
                {
                    continue;
                }

                if (!MatchesTargetTable(targetTable, resource))
                {
                    continue;
                }

                HashSet<string> columnNames = new(StringComparer.OrdinalIgnoreCase);
                foreach (Dictionary<string, object?> column in resource.Columns)
                {
                    string? columnName = GetColumnName(column);
                    if (!string.IsNullOrWhiteSpace(columnName))
                    {
                        columnNames.Add(columnName);
                    }
                }

                if (columnNames.Count > 0)
                {
                    return columnNames;
                }
            }
        }

        return null;
    }

    private static bool MatchesTargetTable(SaveTargetTableRef targetTable, ResourceBindingSourceDto resource)
    {
        if (targetTable is UnityCatalogTableRef)
        {
            return string.Equals(resource.Type, "unityCatalogTable", StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Catalog, targetTable.Catalog, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Schema, targetTable.Schema, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Table, targetTable.Table, StringComparison.OrdinalIgnoreCase);
        }

        if (targetTable is LakebaseTableRef lakebaseTarget)
        {
            return string.Equals(resource.Type, "lakebaseProvisionedDatabase", StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.InstanceName, lakebaseTarget.InstanceName, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Database, lakebaseTarget.Database, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Catalog, lakebaseTarget.Catalog, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Schema, lakebaseTarget.Schema, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Table, lakebaseTarget.Table, StringComparison.OrdinalIgnoreCase);
        }

        if (targetTable is LakebaseAutoscalingTableRef autoscalingTarget)
        {
            bool idsMatch =
                string.Equals(resource.ProjectId, autoscalingTarget.ProjectId, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(resource.BranchId, autoscalingTarget.BranchId, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(resource.EndpointId, autoscalingTarget.EndpointId, StringComparison.OrdinalIgnoreCase);

            if (!string.Equals(resource.Type, "lakebaseAutoscaling", StringComparison.OrdinalIgnoreCase) || !idsMatch)
            {
                return false;
            }

            return string.Equals(resource.Database, autoscalingTarget.Database, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Catalog, autoscalingTarget.Catalog, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Schema, autoscalingTarget.Schema, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(resource.Table, autoscalingTarget.Table, StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    private static string? GetColumnName(IReadOnlyDictionary<string, object?> column)
    {
        if (column.TryGetValue("name", out object? lowercaseName) && lowercaseName is string lowercaseString)
        {
            return lowercaseString;
        }

        if (column.TryGetValue("Name", out object? pascalName) && pascalName is string pascalString)
        {
            return pascalString;
        }

        if (column.TryGetValue("columnName", out object? camelName) && camelName is string camelString)
        {
            return camelString;
        }

        if (column.TryGetValue("ColumnName", out object? pascalColumnName) && pascalColumnName is string pascalColumnString)
        {
            return pascalColumnString;
        }

        return null;
    }
}