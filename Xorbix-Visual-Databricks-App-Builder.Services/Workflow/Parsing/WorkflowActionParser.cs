using System.Text.Json;
using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;

internal static class WorkflowActionParser
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    internal static Result<WorkflowActionNodeModel> Parse(WorkflowNodeDto nodeDto)
    {
        if (string.IsNullOrWhiteSpace(nodeDto.Id))
        {
            return Result.Fail<WorkflowActionNodeModel>(new ValidationError("Workflow node id is required."));
        }

        Result<WorkflowActionKind> actionKindResult = ParseActionKind(nodeDto.ActionType);
        if (actionKindResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(actionKindResult.Errors);
        }

        JsonElement paramsElement = JsonSerializer.SerializeToElement(nodeDto.Params, SerializerOptions);
        return actionKindResult.Value switch
        {
            WorkflowActionKind.TriggerToast => ParseTriggerToast(nodeDto.Id, paramsElement),
            WorkflowActionKind.ShowModal => ParseShowModal(nodeDto.Id, paramsElement),
            WorkflowActionKind.SaveToTable => ParseSaveToTable(nodeDto.Id, paramsElement),
            WorkflowActionKind.BuildSql => ParseBuildSql(nodeDto.Id, paramsElement),
            WorkflowActionKind.RunSql => ParseRunSql(nodeDto.Id, paramsElement),
            WorkflowActionKind.SetBinding => ParseSetBinding(nodeDto.Id, paramsElement),
            WorkflowActionKind.StartDatabricksJob => ParseStartDatabricksJob(nodeDto.Id, paramsElement),
            WorkflowActionKind.CallCustomModule => ParseCallCustomModule(nodeDto.Id, paramsElement),
            WorkflowActionKind.CallPrebuiltModule => ParseCallPrebuiltModule(nodeDto.Id, paramsElement),
            _ => Result.Fail<WorkflowActionNodeModel>(new ValidationError($"Workflow node '{nodeDto.Id}' uses unsupported action type '{nodeDto.ActionType}'.")),
        };
    }

    private static Result<WorkflowActionKind> ParseActionKind(string? actionType)
    {
        if (string.IsNullOrWhiteSpace(actionType))
        {
            return Result.Fail<WorkflowActionKind>(new ValidationError("Workflow actionType is required."));
        }

        return actionType.Trim().ToLowerInvariant() switch
        {
            WorkflowParserTokens.ActionTypes.TriggerToast => Result.Ok(WorkflowActionKind.TriggerToast),
            WorkflowParserTokens.ActionTypes.ShowModal => Result.Ok(WorkflowActionKind.ShowModal),
            WorkflowParserTokens.ActionTypes.SaveToTable => Result.Ok(WorkflowActionKind.SaveToTable),
            WorkflowParserTokens.ActionTypes.BuildSql => Result.Ok(WorkflowActionKind.BuildSql),
            WorkflowParserTokens.ActionTypes.RunSql => Result.Ok(WorkflowActionKind.RunSql),
            WorkflowParserTokens.ActionTypes.SetBinding => Result.Ok(WorkflowActionKind.SetBinding),
            WorkflowParserTokens.ActionTypes.StartDatabricksJob => Result.Ok(WorkflowActionKind.StartDatabricksJob),
            WorkflowParserTokens.ActionTypes.CallCustomModule => Result.Ok(WorkflowActionKind.CallCustomModule),
            WorkflowParserTokens.ActionTypes.CallPrebuiltModule => Result.Ok(WorkflowActionKind.CallPrebuiltModule),
            _ => Result.Fail<WorkflowActionKind>(new ValidationError($"Unsupported workflow action type '{actionType}'.")),
        };
    }

    private static Result<WorkflowActionNodeModel> ParseCallCustomModule(string nodeId, JsonElement paramsElement)
    {
        Result<string> functionNameResult = GetRequiredString(paramsElement, "functionName", nodeId);
        if (functionNameResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(functionNameResult.Errors);
        }

        CallCustomModuleActionModel model = new()
        {
            Id = nodeId,
            FunctionName = functionNameResult.Value.Trim(),
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<WorkflowActionNodeModel> ParseCallPrebuiltModule(string nodeId, JsonElement paramsElement)
    {
        Result<string> functionNameResult = GetRequiredString(paramsElement, "functionName", nodeId);
        if (functionNameResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(functionNameResult.Errors);
        }

        Dictionary<string, string> namedArguments = new(StringComparer.Ordinal);
        if (TryGetProperty(paramsElement, "namedArguments", out JsonElement namedArgumentsElement) &&
            namedArgumentsElement.ValueKind == JsonValueKind.Object)
        {
            foreach (JsonProperty property in namedArgumentsElement.EnumerateObject())
            {
                string key = property.Name;
                if (string.IsNullOrWhiteSpace(key))
                {
                    continue;
                }

                if (property.Value.ValueKind != JsonValueKind.String)
                {
                    return Result.Fail<WorkflowActionNodeModel>(new ValidationError($"Workflow node '{nodeId}' has invalid namedArguments.{key}; expected a string."));
                }

                string? value = property.Value.GetString();
                namedArguments[key] = value ?? string.Empty;
            }
        }

        CallPrebuiltModuleActionModel model = new()
        {
            Id = nodeId,
            FunctionName = functionNameResult.Value.Trim(),
            NamedArguments = namedArguments,
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<WorkflowActionNodeModel> ParseTriggerToast(string nodeId, JsonElement paramsElement)
    {
        Result<string> bodyResult = GetRequiredString(paramsElement, "body", nodeId);
        if (bodyResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(bodyResult.Errors);
        }

        Result<ToastDurationModel> durationResult = ParseToastDuration(paramsElement, nodeId);
        if (durationResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(durationResult.Errors);
        }

        Result<string?> iconResult = GetOptionalString(paramsElement, "icon", nodeId);
        if (iconResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(iconResult.Errors);
        }

        TriggerToastActionModel model = new()
        {
            Id = nodeId,
            Body = bodyResult.Value,
            Icon = iconResult.Value,
            Duration = durationResult.Value,
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<WorkflowActionNodeModel> ParseShowModal(string nodeId, JsonElement paramsElement)
    {
        Result<string> modalCodeNameResult = GetRequiredString(paramsElement, "modalCodeName", nodeId);
        if (modalCodeNameResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(modalCodeNameResult.Errors);
        }

        ShowModalActionModel model = new()
        {
            Id = nodeId,
            ModalCodeName = modalCodeNameResult.Value,
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<WorkflowActionNodeModel> ParseSaveToTable(string nodeId, JsonElement paramsElement)
    {
        Result<string> sourceFormComponentCodeNameResult = GetRequiredString(paramsElement, "sourceFormComponentCodeName", nodeId);
        if (sourceFormComponentCodeNameResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(sourceFormComponentCodeNameResult.Errors);
        }

        Result<SaveTargetTableRef> targetTableResult = ParseSaveTargetTable(paramsElement, nodeId);
        if (targetTableResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(targetTableResult.Errors);
        }

        Result<List<SaveToTableColumnOverride>> excludedColumnsResult = ParseExcludedColumns(paramsElement, nodeId);
        if (excludedColumnsResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(excludedColumnsResult.Errors);
        }

        Result<List<SaveToTableColumnMapping>> columnMappingsResult = ParseColumnMappings(paramsElement, nodeId);
        if (columnMappingsResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(columnMappingsResult.Errors);
        }

        SaveToTableActionModel model = new()
        {
            Id = nodeId,
            SourceFormComponentCodeName = sourceFormComponentCodeNameResult.Value,
            TargetTable = targetTableResult.Value,
            ExcludedColumns = excludedColumnsResult.Value,
            ColumnMappings = columnMappingsResult.Value,
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<WorkflowActionNodeModel> ParseBuildSql(string nodeId, JsonElement paramsElement)
    {
        Result<WorkflowSqlSourceKind> sqlSourceKindResult = ParseSqlSourceKind(paramsElement, nodeId);
        if (sqlSourceKindResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(sqlSourceKindResult.Errors);
        }

        Result<string> sqlTemplateResult = GetRequiredString(paramsElement, "sqlTemplate", nodeId);
        if (sqlTemplateResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(sqlTemplateResult.Errors);
        }

        Result<List<BuildSqlPlaceholderReference>> placeholdersResult = ParseBuildSqlPlaceholders(paramsElement, nodeId);
        if (placeholdersResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(placeholdersResult.Errors);
        }

        Result<string?> lakebaseResourceNameResult = GetOptionalString(paramsElement, "lakebaseAppResourceName", nodeId);
        if (lakebaseResourceNameResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(lakebaseResourceNameResult.Errors);
        }

        Result<string?> lakebaseDatabaseNameResult = GetOptionalString(paramsElement, "lakebaseDatabaseName", nodeId);
        if (lakebaseDatabaseNameResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(lakebaseDatabaseNameResult.Errors);
        }

        string? lakebaseAppResourceName = string.IsNullOrWhiteSpace(lakebaseResourceNameResult.Value)
            ? null
            : lakebaseResourceNameResult.Value!.Trim();
        string? lakebaseDatabaseName = string.IsNullOrWhiteSpace(lakebaseDatabaseNameResult.Value)
            ? null
            : lakebaseDatabaseNameResult.Value!.Trim();

        BuildSqlActionModel model = new()
        {
            Id = nodeId,
            SqlSourceKind = sqlSourceKindResult.Value,
            SqlTemplate = sqlTemplateResult.Value,
            Placeholders = placeholdersResult.Value,
            LakebaseAppResourceName = lakebaseAppResourceName,
            LakebaseDatabaseName = lakebaseDatabaseName,
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<WorkflowActionNodeModel> ParseRunSql(string nodeId, JsonElement paramsElement)
    {
        Result<RunSqlStatementRef> statementResult = ParseRunSqlStatement(paramsElement, nodeId);
        if (statementResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(statementResult.Errors);
        }

        RunSqlActionModel model = new()
        {
            Id = nodeId,
            Statement = statementResult.Value,
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<WorkflowActionNodeModel> ParseSetBinding(string nodeId, JsonElement paramsElement)
    {
        Result<SetBindingSourceRef> sourceResult = ParseSetBindingSource(paramsElement, nodeId);
        if (sourceResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(sourceResult.Errors);
        }

        Result<SetBindingTargetRef> targetResult = ParseSetBindingTarget(paramsElement, nodeId);
        if (targetResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(targetResult.Errors);
        }

        SetBindingActionModel model = new()
        {
            Id = nodeId,
            Source = sourceResult.Value,
            Target = targetResult.Value,
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<WorkflowActionNodeModel> ParseStartDatabricksJob(string nodeId, JsonElement paramsElement)
    {
        Result<DatabricksJobResourceRef> jobResult = ParseDatabricksJob(paramsElement, nodeId);
        if (jobResult.IsFailed)
        {
            return Result.Fail<WorkflowActionNodeModel>(jobResult.Errors);
        }

        StartDatabricksJobActionModel model = new()
        {
            Id = nodeId,
            Job = jobResult.Value,
        };

        return Result.Ok<WorkflowActionNodeModel>(model);
    }

    private static Result<ToastDurationModel> ParseToastDuration(JsonElement paramsElement, string nodeId)
    {
        if (!TryGetProperty(paramsElement, "duration", out JsonElement durationElement))
        {
            return Result.Fail<ToastDurationModel>(new ValidationError($"Workflow node '{nodeId}' requires 'duration'."));
        }

        if (durationElement.ValueKind != JsonValueKind.Object)
        {
            return Result.Fail<ToastDurationModel>(new ValidationError($"Workflow node '{nodeId}' has invalid 'duration'. Expected a duration object."));
        }

        Result<string> kindResult = GetRequiredString(durationElement, "kind", nodeId);
        if (kindResult.IsFailed)
        {
            return Result.Fail<ToastDurationModel>(kindResult.Errors);
        }

        if (string.Equals(kindResult.Value, WorkflowParserTokens.Duration.Preset, StringComparison.OrdinalIgnoreCase))
        {
            Result<string> valueResult = GetRequiredString(durationElement, "value", nodeId);
            if (valueResult.IsFailed)
            {
                return Result.Fail<ToastDurationModel>(valueResult.Errors);
            }

            Result<ToastPresetDuration> presetResult = ParseToastPresetDuration(valueResult.Value, nodeId);
            if (presetResult.IsFailed)
            {
                return Result.Fail<ToastDurationModel>(presetResult.Errors);
            }

            return Result.Ok<ToastDurationModel>(new ToastPresetDurationModel { Value = presetResult.Value });
        }

        if (string.Equals(kindResult.Value, WorkflowParserTokens.Duration.Seconds, StringComparison.OrdinalIgnoreCase))
        {
            if (!TryGetProperty(durationElement, "value", out JsonElement secondsElement))
            {
                return Result.Fail<ToastDurationModel>(new ValidationError($"Workflow node '{nodeId}' requires 'duration.value' when duration kind is 'seconds'."));
            }

            Result<int> secondsResult = ReadPositiveInt(secondsElement, "duration.value", nodeId);
            if (secondsResult.IsFailed)
            {
                return Result.Fail<ToastDurationModel>(secondsResult.Errors);
            }

            return Result.Ok<ToastDurationModel>(new ToastSecondsDurationModel { Value = secondsResult.Value });
        }

        return Result.Fail<ToastDurationModel>(new ValidationError($"Workflow node '{nodeId}' has unsupported duration kind '{kindResult.Value}'."));
    }

    private static Result<ToastPresetDuration> ParseToastPresetDuration(string value, string nodeId)
    {
        return value.Trim().ToLowerInvariant() switch
        {
            WorkflowParserTokens.Duration.Short => Result.Ok(ToastPresetDuration.Short),
            WorkflowParserTokens.Duration.Long => Result.Ok(ToastPresetDuration.Long),
            WorkflowParserTokens.Duration.Infinite => Result.Ok(ToastPresetDuration.Infinite),
            _ => Result.Fail<ToastPresetDuration>(new ValidationError($"Workflow node '{nodeId}' has unsupported toast duration preset '{value}'.")),
        };
    }

    private static Result<SaveTargetTableRef> ParseSaveTargetTable(JsonElement paramsElement, string nodeId)
    {
        if (TryGetProperty(paramsElement, "targetTable", out JsonElement targetTableElement))
        {
            return ParseSaveTargetTableObject(targetTableElement, nodeId);
        }

        return Result.Fail<SaveTargetTableRef>(new ValidationError($"Workflow node '{nodeId}' requires 'targetTable'."));
    }

    private static Result<SaveTargetTableRef> ParseSaveTargetTableObject(JsonElement targetTableElement, string nodeId)
    {
        if (targetTableElement.ValueKind != JsonValueKind.Object)
        {
            return Result.Fail<SaveTargetTableRef>(new ValidationError($"Workflow node '{nodeId}' has invalid 'targetTable'. Expected an object."));
        }

        Result<string> tableTypeResult = GetRequiredString(targetTableElement, "tableType", nodeId);
        if (tableTypeResult.IsFailed)
        {
            return Result.Fail<SaveTargetTableRef>(tableTypeResult.Errors);
        }

        Result<int> workspaceConnectionIdResult = GetRequiredInt(targetTableElement, "workspaceConnectionId", nodeId);
        if (workspaceConnectionIdResult.IsFailed)
        {
            return Result.Fail<SaveTargetTableRef>(workspaceConnectionIdResult.Errors);
        }

        Result<string> catalogResult = GetRequiredString(targetTableElement, "catalog", nodeId);
        if (catalogResult.IsFailed)
        {
            return Result.Fail<SaveTargetTableRef>(catalogResult.Errors);
        }

        Result<string> schemaResult = GetRequiredString(targetTableElement, "schema", nodeId);
        if (schemaResult.IsFailed)
        {
            return Result.Fail<SaveTargetTableRef>(schemaResult.Errors);
        }

        Result<string> tableResult = GetRequiredString(targetTableElement, "table", nodeId);
        if (tableResult.IsFailed)
        {
            return Result.Fail<SaveTargetTableRef>(tableResult.Errors);
        }

        if (string.Equals(tableTypeResult.Value, WorkflowParserTokens.SaveToTable.TargetUnityCatalogTable, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Ok<SaveTargetTableRef>(new UnityCatalogTableRef
            {
                WorkspaceConnectionId = workspaceConnectionIdResult.Value,
                Catalog = catalogResult.Value,
                Schema = schemaResult.Value,
                Table = tableResult.Value,
            });
        }

        if (string.Equals(tableTypeResult.Value, WorkflowParserTokens.SaveToTable.TargetLakebaseProvisionedDatabase, StringComparison.OrdinalIgnoreCase))
        {
            Result<string> instanceNameResult = GetRequiredString(targetTableElement, "instanceName", nodeId);
            if (instanceNameResult.IsFailed)
            {
                return Result.Fail<SaveTargetTableRef>(instanceNameResult.Errors);
            }

            Result<string> databaseResult = GetRequiredString(targetTableElement, "database", nodeId);
            if (databaseResult.IsFailed)
            {
                return Result.Fail<SaveTargetTableRef>(databaseResult.Errors);
            }

            return Result.Ok<SaveTargetTableRef>(new LakebaseTableRef
            {
                WorkspaceConnectionId = workspaceConnectionIdResult.Value,
                InstanceName = instanceNameResult.Value,
                Database = databaseResult.Value,
                Catalog = catalogResult.Value,
                Schema = schemaResult.Value,
                Table = tableResult.Value,
            });
        }

        if (string.Equals(tableTypeResult.Value, "lakebaseAutoscaling", StringComparison.OrdinalIgnoreCase))
        {
            Result<string> projectIdResult = GetRequiredString(targetTableElement, "projectId", nodeId);
            if (projectIdResult.IsFailed)
            {
                return Result.Fail<SaveTargetTableRef>(projectIdResult.Errors);
            }

            Result<string> branchIdResult = GetRequiredString(targetTableElement, "branchId", nodeId);
            if (branchIdResult.IsFailed)
            {
                return Result.Fail<SaveTargetTableRef>(branchIdResult.Errors);
            }

            Result<string> endpointIdResult = GetRequiredString(targetTableElement, "endpointId", nodeId);
            if (endpointIdResult.IsFailed)
            {
                return Result.Fail<SaveTargetTableRef>(endpointIdResult.Errors);
            }

            Result<string> databaseResult = GetRequiredString(targetTableElement, "database", nodeId);
            if (databaseResult.IsFailed)
            {
                return Result.Fail<SaveTargetTableRef>(databaseResult.Errors);
            }

            return Result.Ok<SaveTargetTableRef>(new LakebaseAutoscalingTableRef
            {
                WorkspaceConnectionId = workspaceConnectionIdResult.Value,
                ProjectId = projectIdResult.Value,
                BranchId = branchIdResult.Value,
                EndpointId = endpointIdResult.Value,
                Database = databaseResult.Value,
                Catalog = catalogResult.Value,
                Schema = schemaResult.Value,
                Table = tableResult.Value,
            });
        }

        return Result.Fail<SaveTargetTableRef>(new ValidationError($"Workflow node '{nodeId}' has unsupported SaveToTable target table type '{tableTypeResult.Value}'."));
    }

    private static Result<List<SaveToTableColumnOverride>> ParseExcludedColumns(JsonElement paramsElement, string nodeId)
    {
        if (!TryGetProperty(paramsElement, "excludedColumns", out JsonElement excludedColumnsElement))
        {
            return Result.Ok(new List<SaveToTableColumnOverride>());
        }

        if (excludedColumnsElement.ValueKind != JsonValueKind.Array)
        {
            return Result.Fail<List<SaveToTableColumnOverride>>(new ValidationError($"Workflow node '{nodeId}' has invalid 'excludedColumns'. Expected an array."));
        }

        List<SaveToTableColumnOverride> excludedColumns = new();
        foreach (JsonElement excludedColumnElement in excludedColumnsElement.EnumerateArray())
        {
            Result<string> columnNameResult = GetRequiredString(excludedColumnElement, "columnName", nodeId);
            if (columnNameResult.IsFailed)
            {
                return Result.Fail<List<SaveToTableColumnOverride>>(columnNameResult.Errors);
            }

            Result<string> reasonValueResult = GetRequiredString(excludedColumnElement, "reason", nodeId);
            if (reasonValueResult.IsFailed)
            {
                return Result.Fail<List<SaveToTableColumnOverride>>(reasonValueResult.Errors);
            }

            Result<SaveToTableColumnOverrideReason> reasonResult = ParseSaveToTableOverrideReason(reasonValueResult.Value, nodeId);
            if (reasonResult.IsFailed)
            {
                return Result.Fail<List<SaveToTableColumnOverride>>(reasonResult.Errors);
            }

            excludedColumns.Add(new SaveToTableColumnOverride
            {
                ColumnName = columnNameResult.Value,
                Reason = reasonResult.Value,
            });
        }

        return Result.Ok(excludedColumns);
    }

    private static Result<List<SaveToTableColumnMapping>> ParseColumnMappings(JsonElement paramsElement, string nodeId)
    {
        if (!TryGetProperty(paramsElement, "columnMappings", out JsonElement columnMappingsElement))
        {
            return Result.Ok(new List<SaveToTableColumnMapping>());
        }

        if (columnMappingsElement.ValueKind != JsonValueKind.Array)
        {
            return Result.Fail<List<SaveToTableColumnMapping>>(new ValidationError($"Workflow node '{nodeId}' has invalid 'columnMappings'. Expected an array."));
        }

        List<SaveToTableColumnMapping> columnMappings = new();
        foreach (JsonElement columnMappingElement in columnMappingsElement.EnumerateArray())
        {
            Result<string> formChildComponentCodeNameResult = GetRequiredString(columnMappingElement, "formChildComponentCodeName", nodeId);
            if (formChildComponentCodeNameResult.IsFailed)
            {
                return Result.Fail<List<SaveToTableColumnMapping>>(formChildComponentCodeNameResult.Errors);
            }

            Result<string> targetColumnNameResult = GetRequiredString(columnMappingElement, "targetColumnName", nodeId);
            if (targetColumnNameResult.IsFailed)
            {
                return Result.Fail<List<SaveToTableColumnMapping>>(targetColumnNameResult.Errors);
            }

            columnMappings.Add(new SaveToTableColumnMapping
            {
                FormChildComponentCodeName = formChildComponentCodeNameResult.Value,
                TargetColumnName = targetColumnNameResult.Value,
            });
        }

        return Result.Ok(columnMappings);
    }

    private static Result<SaveToTableColumnOverrideReason> ParseSaveToTableOverrideReason(string value, string nodeId)
    {
        return value.Trim().ToLowerInvariant() switch
        {
            WorkflowParserTokens.SaveToTable.OverrideReasonAutogenerated => Result.Ok(SaveToTableColumnOverrideReason.Autogenerated),
            WorkflowParserTokens.SaveToTable.OverrideReasonSystemManaged => Result.Ok(SaveToTableColumnOverrideReason.SystemManaged),
            WorkflowParserTokens.SaveToTable.OverrideReasonManualSkip => Result.Ok(SaveToTableColumnOverrideReason.ManualSkip),
            _ => Result.Fail<SaveToTableColumnOverrideReason>(new ValidationError($"Workflow node '{nodeId}' has unsupported SaveToTable excluded column reason '{value}'.")),
        };
    }

    private static Result<WorkflowSqlSourceKind> ParseSqlSourceKind(JsonElement paramsElement, string nodeId)
    {
        Result<string> sqlSourceKindValueResult = GetRequiredString(paramsElement, "sqlSourceKind", nodeId);
        if (sqlSourceKindValueResult.IsFailed)
        {
            return Result.Fail<WorkflowSqlSourceKind>(sqlSourceKindValueResult.Errors);
        }

        return sqlSourceKindValueResult.Value.Trim() switch
        {
            WorkflowParserTokens.SqlSourceKind.UnityCatalogTable => Result.Ok(WorkflowSqlSourceKind.UnityCatalogTable),
            WorkflowParserTokens.SqlSourceKind.LakebaseProvisionedDatabase => Result.Ok(WorkflowSqlSourceKind.LakebaseProvisionedDatabase),
            WorkflowParserTokens.SqlSourceKind.LakebaseAutoscaling => Result.Ok(WorkflowSqlSourceKind.LakebaseAutoscaling),
            _ => Result.Fail<WorkflowSqlSourceKind>(new ValidationError($"Workflow node '{nodeId}' has unsupported sqlSourceKind '{sqlSourceKindValueResult.Value}'.")),
        };
    }

    private static Result<List<BuildSqlPlaceholderReference>> ParseBuildSqlPlaceholders(JsonElement paramsElement, string nodeId)
    {
        if (!TryGetProperty(paramsElement, "placeholders", out JsonElement placeholdersElement))
        {
            return Result.Ok(new List<BuildSqlPlaceholderReference>());
        }

        if (placeholdersElement.ValueKind != JsonValueKind.Array)
        {
            return Result.Fail<List<BuildSqlPlaceholderReference>>(new ValidationError($"Workflow node '{nodeId}' has invalid 'placeholders'. Expected an array."));
        }

        List<BuildSqlPlaceholderReference> placeholders = new();
        foreach (JsonElement placeholderElement in placeholdersElement.EnumerateArray())
        {
            Result<string> tokenResult = GetRequiredString(placeholderElement, "token", nodeId);
            if (tokenResult.IsFailed)
            {
                return Result.Fail<List<BuildSqlPlaceholderReference>>(tokenResult.Errors);
            }

            Result<string> componentCodeNameResult = GetRequiredString(placeholderElement, "componentCodeName", nodeId);
            if (componentCodeNameResult.IsFailed)
            {
                return Result.Fail<List<BuildSqlPlaceholderReference>>(componentCodeNameResult.Errors);
            }

            Result<string> valueTypeValueResult = GetRequiredString(placeholderElement, "valueType", nodeId);
            if (valueTypeValueResult.IsFailed)
            {
                return Result.Fail<List<BuildSqlPlaceholderReference>>(valueTypeValueResult.Errors);
            }

            Result<WorkflowValueType> valueTypeResult = ParseWorkflowValueType(valueTypeValueResult.Value, nodeId);
            if (valueTypeResult.IsFailed)
            {
                return Result.Fail<List<BuildSqlPlaceholderReference>>(valueTypeResult.Errors);
            }

            Result<BuildSqlFormatHint?> formatHintResult = ParseBuildSqlFormatHint(placeholderElement, nodeId);
            if (formatHintResult.IsFailed)
            {
                return Result.Fail<List<BuildSqlPlaceholderReference>>(formatHintResult.Errors);
            }

            placeholders.Add(new BuildSqlPlaceholderReference
            {
                Token = tokenResult.Value,
                ComponentCodeName = componentCodeNameResult.Value,
                ValueType = valueTypeResult.Value,
                FormatHint = formatHintResult.Value,
            });
        }

        return Result.Ok(placeholders);
    }

    private static Result<WorkflowValueType> ParseWorkflowValueType(string value, string nodeId)
    {
        return value.Trim() switch
        {
            WorkflowParserTokens.BuildSql.String => Result.Ok(WorkflowValueType.String),
            WorkflowParserTokens.BuildSql.Number => Result.Ok(WorkflowValueType.Number),
            WorkflowParserTokens.BuildSql.Boolean => Result.Ok(WorkflowValueType.Boolean),
            WorkflowParserTokens.BuildSql.Date => Result.Ok(WorkflowValueType.Date),
            WorkflowParserTokens.BuildSql.DateTime => Result.Ok(WorkflowValueType.DateTime),
            WorkflowParserTokens.BuildSql.Unknown => Result.Ok(WorkflowValueType.Unknown),
            _ => Result.Fail<WorkflowValueType>(new ValidationError($"Workflow node '{nodeId}' has unsupported placeholder valueType '{value}'.")),
        };
    }

    private static Result<BuildSqlFormatHint?> ParseBuildSqlFormatHint(JsonElement placeholderElement, string nodeId)
    {
        Result<string?> formatHintValueResult = GetOptionalString(placeholderElement, "formatHint", nodeId);
        if (formatHintValueResult.IsFailed)
        {
            return Result.Fail<BuildSqlFormatHint?>(formatHintValueResult.Errors);
        }

        if (string.IsNullOrWhiteSpace(formatHintValueResult.Value))
        {
            return Result.Ok<BuildSqlFormatHint?>(null);
        }

        return formatHintValueResult.Value.Trim() switch
        {
            WorkflowParserTokens.BuildSql.Raw => Result.Ok<BuildSqlFormatHint?>(BuildSqlFormatHint.Raw),
            WorkflowParserTokens.BuildSql.SqlStringLiteral => Result.Ok<BuildSqlFormatHint?>(BuildSqlFormatHint.SqlStringLiteral),
            WorkflowParserTokens.BuildSql.SqlIdentifier => Result.Ok<BuildSqlFormatHint?>(BuildSqlFormatHint.SqlIdentifier),
            WorkflowParserTokens.BuildSql.DateLiteral => Result.Ok<BuildSqlFormatHint?>(BuildSqlFormatHint.DateLiteral),
            _ => Result.Fail<BuildSqlFormatHint?>(new ValidationError($"Workflow node '{nodeId}' has unsupported placeholder formatHint '{formatHintValueResult.Value}'.")),
        };
    }

    private static Result<RunSqlStatementRef> ParseRunSqlStatement(JsonElement paramsElement, string nodeId)
    {
        if (TryGetProperty(paramsElement, "statement", out JsonElement statementElement))
        {
            Result<string> sourceActionTypeResult = GetRequiredString(statementElement, "sourceActionType", nodeId);
            if (sourceActionTypeResult.IsFailed)
            {
                return Result.Fail<RunSqlStatementRef>(sourceActionTypeResult.Errors);
            }

            if (!string.Equals(sourceActionTypeResult.Value, WorkflowParserTokens.RunSql.SourceActionTypeBuildSql, StringComparison.Ordinal))
            {
                return Result.Fail<RunSqlStatementRef>(new ValidationError($"Workflow node '{nodeId}' requires statement.sourceActionType to be '{WorkflowParserTokens.RunSql.SourceActionTypeBuildSql}'."));
            }

            Result<string> sourceNodeIdResult = GetRequiredString(statementElement, "nodeId", nodeId);
            if (sourceNodeIdResult.IsFailed)
            {
                return Result.Fail<RunSqlStatementRef>(sourceNodeIdResult.Errors);
            }

            return Result.Ok(new RunSqlStatementRef
            {
                SourceActionType = RunSqlStatementSourceActionType.BuildSql,
                NodeId = sourceNodeIdResult.Value,
            });
        }

        return Result.Fail<RunSqlStatementRef>(new ValidationError($"Workflow node '{nodeId}' requires 'statement'."));
    }

    private static Result<SetBindingSourceRef> ParseSetBindingSource(JsonElement paramsElement, string nodeId)
    {
        if (TryGetProperty(paramsElement, "source", out JsonElement sourceElement))
        {
            Result<string> sourceActionTypeResult = GetRequiredString(sourceElement, "sourceActionType", nodeId);
            if (sourceActionTypeResult.IsFailed)
            {
                return Result.Fail<SetBindingSourceRef>(sourceActionTypeResult.Errors);
            }

            if (!string.Equals(sourceActionTypeResult.Value, WorkflowParserTokens.SetBinding.SourceActionTypeRunSql, StringComparison.Ordinal))
            {
                return Result.Fail<SetBindingSourceRef>(new ValidationError($"Workflow node '{nodeId}' requires source.sourceActionType to be '{WorkflowParserTokens.SetBinding.SourceActionTypeRunSql}'."));
            }

            Result<string> sourceNodeIdResult = GetRequiredString(sourceElement, "nodeId", nodeId);
            if (sourceNodeIdResult.IsFailed)
            {
                return Result.Fail<SetBindingSourceRef>(sourceNodeIdResult.Errors);
            }

            Result<string> outputKeyValueResult = GetRequiredString(sourceElement, "outputKey", nodeId);
            if (outputKeyValueResult.IsFailed)
            {
                return Result.Fail<SetBindingSourceRef>(outputKeyValueResult.Errors);
            }

            if (!string.Equals(outputKeyValueResult.Value, WorkflowParserTokens.SetBinding.SourceOutputRows, StringComparison.Ordinal))
            {
                return Result.Fail<SetBindingSourceRef>(new ValidationError($"Workflow node '{nodeId}' requires source.outputKey to be '{WorkflowParserTokens.SetBinding.SourceOutputRows}'."));
            }

            return Result.Ok(new SetBindingSourceRef
            {
                SourceActionType = SetBindingSourceActionType.RunSql,
                NodeId = sourceNodeIdResult.Value,
                OutputKey = SetBindingOutputKey.Rows,
            });
        }

        return Result.Fail<SetBindingSourceRef>(new ValidationError($"Workflow node '{nodeId}' requires 'source'."));
    }

    private static Result<SetBindingTargetRef> ParseSetBindingTarget(JsonElement paramsElement, string nodeId)
    {
        if (TryGetProperty(paramsElement, "target", out JsonElement targetElement))
        {
            Result<string> componentCodeNameResult = GetRequiredString(targetElement, "componentCodeName", nodeId);
            if (componentCodeNameResult.IsFailed)
            {
                return Result.Fail<SetBindingTargetRef>(componentCodeNameResult.Errors);
            }

            Result<string> bindingTypeValueResult = GetRequiredString(targetElement, "bindingType", nodeId);
            if (bindingTypeValueResult.IsFailed)
            {
                return Result.Fail<SetBindingTargetRef>(bindingTypeValueResult.Errors);
            }

            Result<SetBindingTargetType> bindingTypeResult = ParseSetBindingTargetType(bindingTypeValueResult.Value, nodeId);
            if (bindingTypeResult.IsFailed)
            {
                return Result.Fail<SetBindingTargetRef>(bindingTypeResult.Errors);
            }

            return Result.Ok(new SetBindingTargetRef
            {
                ComponentCodeName = componentCodeNameResult.Value,
                BindingType = bindingTypeResult.Value,
            });
        }

        return Result.Fail<SetBindingTargetRef>(new ValidationError($"Workflow node '{nodeId}' requires 'target'."));
    }

    private static Result<SetBindingTargetType> ParseSetBindingTargetType(string value, string nodeId)
    {
        return value.Trim() switch
        {
            WorkflowParserTokens.SetBinding.TargetUnityCatalogTable => Result.Ok(SetBindingTargetType.UnityCatalogTable),
            WorkflowParserTokens.SetBinding.TargetChartData => Result.Ok(SetBindingTargetType.ChartData),
            _ => Result.Fail<SetBindingTargetType>(new ValidationError($"Workflow node '{nodeId}' has unsupported SetBinding target bindingType '{value}'.")),
        };
    }

    private static Result<DatabricksJobResourceRef> ParseDatabricksJob(JsonElement paramsElement, string nodeId)
    {
        if (TryGetProperty(paramsElement, "job", out JsonElement jobElement))
        {
            Result<int> workspaceConnectionIdResult = GetRequiredInt(jobElement, "workspaceConnectionId", nodeId);
            if (workspaceConnectionIdResult.IsFailed)
            {
                return Result.Fail<DatabricksJobResourceRef>(workspaceConnectionIdResult.Errors);
            }

            Result<string> jobIdResult = GetRequiredString(jobElement, "jobId", nodeId);
            if (jobIdResult.IsFailed)
            {
                return Result.Fail<DatabricksJobResourceRef>(jobIdResult.Errors);
            }

            Result<string> jobNameResult = GetRequiredString(jobElement, "jobName", nodeId);
            if (jobNameResult.IsFailed)
            {
                return Result.Fail<DatabricksJobResourceRef>(jobNameResult.Errors);
            }

            return Result.Ok(new DatabricksJobResourceRef
            {
                WorkspaceConnectionId = workspaceConnectionIdResult.Value,
                JobId = jobIdResult.Value,
                JobName = jobNameResult.Value,
            });
        }

        return Result.Fail<DatabricksJobResourceRef>(new ValidationError($"Workflow node '{nodeId}' requires 'job'."));
    }

    private static Result<string> GetRequiredString(JsonElement objectElement, string propertyName, string nodeId)
    {
        if (!TryGetProperty(objectElement, propertyName, out JsonElement propertyElement))
        {
            return Result.Fail<string>(new ValidationError($"Workflow node '{nodeId}' requires '{propertyName}'."));
        }

        return ReadRequiredString(propertyElement, propertyName, nodeId);
    }

    private static Result<string> ReadRequiredString(JsonElement propertyElement, string propertyName, string nodeId)
    {
        if (propertyElement.ValueKind != JsonValueKind.String)
        {
            return Result.Fail<string>(new ValidationError($"Workflow node '{nodeId}' has invalid '{propertyName}'. Expected a string."));
        }

        string value = propertyElement.GetString() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(value))
        {
            return Result.Fail<string>(new ValidationError($"Workflow node '{nodeId}' requires non-empty '{propertyName}'."));
        }

        return Result.Ok(value);
    }

    private static Result<string?> GetOptionalString(JsonElement objectElement, string propertyName, string nodeId)
    {
        if (!TryGetProperty(objectElement, propertyName, out JsonElement propertyElement) || propertyElement.ValueKind == JsonValueKind.Null)
        {
            return Result.Ok<string?>(null);
        }

        if (propertyElement.ValueKind != JsonValueKind.String)
        {
            return Result.Fail<string?>(new ValidationError($"Workflow node '{nodeId}' has invalid '{propertyName}'. Expected a string."));
        }

        return Result.Ok<string?>(propertyElement.GetString());
    }

    private static Result<int> GetRequiredInt(JsonElement objectElement, string propertyName, string nodeId)
    {
        if (!TryGetProperty(objectElement, propertyName, out JsonElement propertyElement))
        {
            return Result.Fail<int>(new ValidationError($"Workflow node '{nodeId}' requires '{propertyName}'."));
        }

        return ReadPositiveInt(propertyElement, propertyName, nodeId);
    }

    private static Result<int> ReadPositiveInt(JsonElement propertyElement, string propertyName, string nodeId)
    {
        int value;
        if (propertyElement.ValueKind == JsonValueKind.Number && propertyElement.TryGetInt32(out value))
        {
            if (value > 0)
            {
                return Result.Ok(value);
            }

            return Result.Fail<int>(new ValidationError($"Workflow node '{nodeId}' requires '{propertyName}' to be a positive integer."));
        }

        if (propertyElement.ValueKind == JsonValueKind.String && int.TryParse(propertyElement.GetString(), out value) && value > 0)
        {
            return Result.Ok(value);
        }

        return Result.Fail<int>(new ValidationError($"Workflow node '{nodeId}' has invalid '{propertyName}'. Expected a positive integer."));
    }

    private static bool TryGetProperty(JsonElement objectElement, string propertyName, out JsonElement propertyElement)
    {
        if (objectElement.ValueKind == JsonValueKind.Object)
        {
            foreach (JsonProperty property in objectElement.EnumerateObject())
            {
                if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    propertyElement = property.Value;
                    return true;
                }
            }
        }

        propertyElement = default;
        return false;
    }
}