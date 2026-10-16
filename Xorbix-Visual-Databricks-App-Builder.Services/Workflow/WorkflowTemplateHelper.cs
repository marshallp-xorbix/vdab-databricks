using FluentResults;
using System.Globalization;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

public class WorkflowTemplateHelper : IWorkflowTemplateHelper
{
    private readonly IEnumerable<IWorkflowActionGenerator> _actionGenerators;
    private readonly WorkflowTemplateValidator _workflowTemplateValidator;

    public WorkflowTemplateHelper(
        IEnumerable<IWorkflowActionGenerator> actionGenerators,
        WorkflowTemplateValidator workflowTemplateValidator)
    {
        _actionGenerators = actionGenerators;
        _workflowTemplateValidator = workflowTemplateValidator;
    }

    public Result Validate(
        List<VdabComponentDto> components,
        WorkflowDefinitionDto workflowDefinition,
        IReadOnlyList<NormalizedAppResourceDto>? normalizedAppResources = null)
    {
        return _workflowTemplateValidator.Validate(components, workflowDefinition, normalizedAppResources);
    }

    public void AppendRuntime(
        StringBuilder sb,
        WorkflowDefinitionDto workflowDefinition,
        List<VdabComponentDto> components)
    {
        Result<WorkflowDefinitionModel> validatedWorkflowResult = GetValidatedWorkflowDefinition(components, workflowDefinition);
        if (validatedWorkflowResult.IsFailed)
        {
            throw new InvalidOperationException(validatedWorkflowResult.Errors.FirstOrDefault()?.Message ?? "Workflow runtime generation requires a valid workflow definition.");
        }

        WorkflowDefinitionModel parsedWorkflowDefinition = validatedWorkflowResult.Value;
        sb.AppendLine("workflow_results = {}");
        sb.AppendLine("binding_overrides = st.session_state.setdefault('binding_overrides', {})");
        sb.AppendLine("ui_overrides = st.session_state.setdefault('ui_overrides', {})");
        sb.AppendLine();
        AppendVdabComponentRegistry(sb, components);
        AppendRuntimeHelpers(sb);

        foreach (WorkflowModel workflow in parsedWorkflowDefinition.Workflows)
        {
            AppendWorkflowHandler(sb, workflow, components);
        }
    }

    private Result<WorkflowDefinitionModel> GetValidatedWorkflowDefinition(
        List<VdabComponentDto> components,
        WorkflowDefinitionDto workflowDefinition)
    {
        Result validationResult = _workflowTemplateValidator.Validate(components, workflowDefinition, normalizedAppResources: null);
        if (validationResult.IsFailed)
        {
            return Result.Fail<WorkflowDefinitionModel>(validationResult.Errors);
        }

        return WorkflowDefinitionParser.Parse(workflowDefinition);
    }

    private static void AppendVdabComponentRegistry(StringBuilder sb, List<VdabComponentDto> components)
    {
        sb.AppendLine("vdab_component_registry = {");
        foreach (VdabComponentDto component in components)
        {
            if (string.IsNullOrWhiteSpace(component.CodeName))
            {
                continue;
            }

            string widgetKey;
            try
            {
                widgetKey = CodeNameUtility.ResolveVariableName(component);
            }
            catch (InvalidOperationException)
            {
                continue;
            }

            if (component.Type == ComponentType.FileUpload)
            {
                widgetKey = $"{widgetKey}_uploader";
            }

            string codeNameLiteral = BuildPythonStringLiteral(component.CodeName);
            string widgetKeyLiteral = BuildPythonStringLiteral(widgetKey);
            string typeLiteral = BuildPythonStringLiteral(component.Type.ToString());
            sb.AppendLine($"    {codeNameLiteral}: {{'code_name': {codeNameLiteral}, 'widget_key': {widgetKeyLiteral}, 'component_type': {typeLiteral}}},");
        }

        sb.AppendLine("}");
        sb.AppendLine();
    }

    private static void AppendCustomModulesRuntimeHelpers(StringBuilder sb)
    {
        sb.AppendLine("def _vdab_registry_lookup(component_code_name):");
        sb.AppendLine("    if component_code_name is None:");
        sb.AppendLine("        return None");
        sb.AppendLine("    if not isinstance(vdab_component_registry, dict):");
        sb.AppendLine("        return None");
        sb.AppendLine("    key = str(component_code_name)");
        sb.AppendLine("    if key in vdab_component_registry:");
        sb.AppendLine("        return vdab_component_registry[key]");
        sb.AppendLine("    key_lower = key.lower()");
        sb.AppendLine("    for registry_key, entry in vdab_component_registry.items():");
        sb.AppendLine("        if str(registry_key).lower() == key_lower:");
        sb.AppendLine("            return entry");
        sb.AppendLine("    return None");
        sb.AppendLine();
        sb.AppendLine("def _get_vdab_component_value(component_code_name):");
        sb.AppendLine("    entry = _vdab_registry_lookup(component_code_name)");
        sb.AppendLine("    if not entry:");
        sb.AppendLine("        return None");
        sb.AppendLine("    widget_key = entry.get('widget_key')");
        sb.AppendLine("    if not widget_key:");
        sb.AppendLine("        return None");
        sb.AppendLine("    return st.session_state.get(widget_key)");
        sb.AppendLine();
        sb.AppendLine("def _set_vdab_component_value(component_code_name, value):");
        sb.AppendLine("    entry = _vdab_registry_lookup(component_code_name)");
        sb.AppendLine("    if not entry:");
        sb.AppendLine("        raise ValueError(\"Unknown VDAB component code name: \" + str(component_code_name))");
        sb.AppendLine("    if entry.get('component_type') == 'Label':");
        sb.AppendLine("        _set_vdab_component_label(component_code_name, value)");
        sb.AppendLine("        return");
        sb.AppendLine("    widget_key = entry.get('widget_key')");
        sb.AppendLine("    st.session_state[widget_key] = value");
        sb.AppendLine();
        sb.AppendLine("def _set_vdab_component_label(component_code_name, label):");
        sb.AppendLine("    entry = _vdab_registry_lookup(component_code_name)");
        sb.AppendLine("    if not entry:");
        sb.AppendLine("        raise ValueError(\"Unknown VDAB component code name: \" + str(component_code_name))");
        sb.AppendLine("    canonical = entry.get('code_name') or str(component_code_name)");
        sb.AppendLine("    ui_overrides.setdefault('labels', {})[canonical] = label");
        sb.AppendLine();
        sb.AppendLine("class _VdabCustomContext:");
        sb.AppendLine("    def __init__(self, workflow_state):");
        sb.AppendLine("        self.workflow_state = workflow_state");
        sb.AppendLine("    def get_value(self, component_code_name):");
        sb.AppendLine("        return _get_vdab_component_value(component_code_name)");
        sb.AppendLine("    def set_value(self, component_code_name, value):");
        sb.AppendLine("        _set_vdab_component_value(component_code_name, value)");
        sb.AppendLine("    def set_label(self, component_code_name, label):");
        sb.AppendLine("        _set_vdab_component_label(component_code_name, label)");
        sb.AppendLine();
        sb.AppendLine("def _create_vdab_custom_context(workflow_state):");
        sb.AppendLine("    return _VdabCustomContext(workflow_state)");
        sb.AppendLine();
        sb.AppendLine("def _vdab_enqueue_toast(body, icon=None, duration=None):");
        sb.AppendLine("    pending_toasts = st.session_state.setdefault('_vdab_pending_toasts', [])");
        sb.AppendLine("    pending_toasts.append({'body': body, 'icon': icon, 'duration': duration})");
        sb.AppendLine();
        sb.AppendLine("def _vdab_flush_toasts():");
        sb.AppendLine("    pending_toasts = st.session_state.pop('_vdab_pending_toasts', [])");
        sb.AppendLine("    for toast in pending_toasts:");
        sb.AppendLine("        kwargs = {}");
        sb.AppendLine("        if toast.get('icon') is not None:");
        sb.AppendLine("            kwargs['icon'] = toast.get('icon')");
        sb.AppendLine("        if toast.get('duration') is not None:");
        sb.AppendLine("            kwargs['duration'] = toast.get('duration')");
        sb.AppendLine("        body = toast.get('body', '')");
        sb.AppendLine("        try:");
        sb.AppendLine("            st.toast(body, **kwargs)");
        sb.AppendLine("        except Exception:");
        sb.AppendLine("            st.error(body)");
        sb.AppendLine();
        sb.AppendLine("def _normalize_custom_module_result(result):");
        sb.AppendLine("    if result is None:");
        sb.AppendLine("        return {}");
        sb.AppendLine("    if isinstance(result, dict):");
        sb.AppendLine("        return result");
        sb.AppendLine("    return {'value': result}");
        sb.AppendLine();
        sb.AppendLine("def _invoke_custom_module(function_name, ctx):");
        sb.AppendLine("    func = getattr(custom_modules, function_name, None)");
        sb.AppendLine("    if func is None or not callable(func):");
        sb.AppendLine("        raise AttributeError(\"custom_modules.\" + str(function_name) + \" is not callable\")");
        sb.AppendLine("    return _normalize_custom_module_result(func(ctx))");
        sb.AppendLine();
    }

    private void AppendRuntimeHelpers(StringBuilder sb)
    {
        AppendCustomModulesRuntimeHelpers(sb);

        sb.AppendLine("def _resolve_workflow_path(source_path, workflow_state):");
        sb.AppendLine("    if not source_path:");
        sb.AppendLine("        return None");
        sb.AppendLine("    normalized_path = str(source_path).replace('[', '.').replace(']', '').strip('.')");
        sb.AppendLine("    path_parts = [part for part in normalized_path.split('.') if part]");
        sb.AppendLine("    current = workflow_state");
        sb.AppendLine("    if path_parts and path_parts[0] in ('workflow', 'workflow_state'):");
        sb.AppendLine("        path_parts = path_parts[1:]");
        sb.AppendLine("    if path_parts and path_parts[0] in ('$last', 'last'):");
        sb.AppendLine("        if not workflow_state:");
        sb.AppendLine("            return None");
        sb.AppendLine("        last_node_id = list(workflow_state.keys())[-1]");
        sb.AppendLine("        current = workflow_state.get(last_node_id)");
        sb.AppendLine("        path_parts = path_parts[1:]");
        sb.AppendLine("    elif path_parts and path_parts[0] in workflow_state:");
        sb.AppendLine("        current = workflow_state.get(path_parts[0])");
        sb.AppendLine("        path_parts = path_parts[1:]");
        sb.AppendLine("    for part in path_parts:");
        sb.AppendLine("        if isinstance(current, dict):");
        sb.AppendLine("            current = current.get(part)");
        sb.AppendLine("        elif isinstance(current, list):");
        sb.AppendLine("            try:");
        sb.AppendLine("                current = current[int(part)]");
        sb.AppendLine("            except (TypeError, ValueError, IndexError):");
        sb.AppendLine("                return None");
        sb.AppendLine("        elif hasattr(current, part):");
        sb.AppendLine("            current = getattr(current, part)");
        sb.AppendLine("        else:");
        sb.AppendLine("            return None");
        sb.AppendLine("    return current");
        sb.AppendLine();

        sb.AppendLine("def _escape_sql_string(value):");
        sb.AppendLine("    return str(value).replace(\"'\", \"''\")");
        sb.AppendLine();

        sb.AppendLine("def _format_build_sql_identifier(value):");
        sb.AppendLine("    if value is None:");
        sb.AppendLine("        return 'NULL'");
        sb.AppendLine("    identifier_parts = [part.strip() for part in str(value).split('.') if part.strip()]");
        sb.AppendLine("    if not identifier_parts:");
        sb.AppendLine("        raise ValueError('BuildSql received an empty sqlIdentifier placeholder value.')");
        sb.AppendLine("    for part in identifier_parts:");
        sb.AppendLine("        if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', part):");
        sb.AppendLine("            raise ValueError(f\"BuildSql received an invalid sqlIdentifier placeholder value '{value}'.\")");
        sb.AppendLine("    return '.'.join(identifier_parts)");
        sb.AppendLine();

        sb.AppendLine("def _format_build_sql_placeholder(value, value_type, format_hint=None):");
        sb.AppendLine("    if value is None:");
        sb.AppendLine("        return 'NULL'");
        sb.AppendLine("    if format_hint == 'sqlIdentifier':");
        sb.AppendLine("        return _format_build_sql_identifier(value)");
        sb.AppendLine("    if format_hint == 'sqlStringLiteral':");
        sb.AppendLine("        return f\"'{_escape_sql_string(value)}'\"");
        sb.AppendLine("    if format_hint == 'dateLiteral':");
        sb.AppendLine("        date_value = value.isoformat() if hasattr(value, 'isoformat') else str(value)");
        sb.AppendLine("        return f\"DATE '{_escape_sql_string(date_value)}'\"");
        sb.AppendLine("    if format_hint == 'raw':");
        sb.AppendLine("        return str(value)");
        sb.AppendLine("    if value_type == 'string':");
        sb.AppendLine("        return f\"'{_escape_sql_string(value)}'\"");
        sb.AppendLine("    if value_type == 'number':");
        sb.AppendLine("        return str(value)");
        sb.AppendLine("    if value_type == 'boolean':");
        sb.AppendLine("        return 'TRUE' if bool(value) else 'FALSE'");
        sb.AppendLine("    if value_type == 'date':");
        sb.AppendLine("        date_value = value.isoformat() if hasattr(value, 'isoformat') else str(value)");
        sb.AppendLine("        return f\"DATE '{_escape_sql_string(date_value)}'\"");
        sb.AppendLine("    if value_type == 'datetime':");
        sb.AppendLine("        datetime_value = value.isoformat() if hasattr(value, 'isoformat') else str(value)");
        sb.AppendLine("        return f\"'{_escape_sql_string(datetime_value)}'\"");
        sb.AppendLine("    return str(value)");
        sb.AppendLine();

        sb.AppendLine("def _format_save_to_table_value(value):");
        sb.AppendLine("    if value is None:");
        sb.AppendLine("        return 'NULL'");
        sb.AppendLine("    if hasattr(value, 'read') or hasattr(value, 'getbuffer'):");
        sb.AppendLine("        raise ValueError('SaveToTable does not support file upload values.')");
        sb.AppendLine("    if isinstance(value, bool):");
        sb.AppendLine("        return 'TRUE' if value else 'FALSE'");
        sb.AppendLine("    if isinstance(value, (int, float)):");
        sb.AppendLine("        return str(value)");
        sb.AppendLine("    if isinstance(value, (list, tuple, dict, set)):");
        sb.AppendLine("        raise ValueError('SaveToTable only supports scalar form values.')");
        sb.AppendLine("    if hasattr(value, 'isoformat'):");
        sb.AppendLine("        return f\"'{_escape_sql_string(value.isoformat())}'\"");
        sb.AppendLine("    return f\"'{_escape_sql_string(value)}'\"");
        sb.AppendLine();

        sb.AppendLine("def _binding_override_to_dataframe(value):");
        sb.AppendLine("    if value is None:");
        sb.AppendLine("        return None");
        sb.AppendLine("    if isinstance(value, pd.DataFrame):");
        sb.AppendLine("        return value");
        sb.AppendLine("    if isinstance(value, dict) and 'rows' in value:");
        sb.AppendLine("        rows_value = value.get('rows')");
        sb.AppendLine("        return rows_value if isinstance(rows_value, pd.DataFrame) else pd.DataFrame(rows_value)");
        sb.AppendLine("    return pd.DataFrame(value)");
        sb.AppendLine();
    }

    private void AppendWorkflowHandler(
        StringBuilder sb,
        WorkflowModel workflow,
        List<VdabComponentDto> components)
    {
        Dictionary<string, WorkflowActionNodeModel> nodesById = workflow.Nodes
            .Where(node => !string.IsNullOrWhiteSpace(node.Id))
            .ToDictionary(node => node.Id, StringComparer.Ordinal);
        WorkflowActionGenerationContext generationContext = new()
        {
            Workflow = workflow,
            NodesById = nodesById,
        };
        string handlerName = $"handle_workflow_{workflow.CodeName}";
        VdabComponentDto? triggerComponent = components.FirstOrDefault(component =>
            string.Equals(component.CodeName, workflow.Trigger.ComponentCodeName, StringComparison.OrdinalIgnoreCase));

        List<string> startNodeIds = GetStartNodeIds(workflow);

        sb.AppendLine($"def {handlerName}():");
        sb.AppendLine("    workflow_state = {}");
        sb.AppendLine("    edge_lookup = {");
        foreach (IGrouping<string, WorkflowEdgeModel> edgeGroup in workflow.Edges.GroupBy(edge => edge.FromNodeId))
        {
            sb.AppendLine($"        '{EscapePythonString(edgeGroup.Key)}': [");
            foreach (WorkflowEdgeModel edge in edgeGroup)
            {
                sb.AppendLine(
                    $"            {{'toNodeId': '{EscapePythonString(edge.ToNodeId)}', 'route': '{EscapePythonString(GetRouteValue(edge.Route))}'}},");
            }
            sb.AppendLine("        ],");
        }
        sb.AppendLine("    }");
        sb.AppendLine($"    pending_node_ids = [{string.Join(", ", startNodeIds.Select(BuildPythonStringLiteral))}]");
        sb.AppendLine("    visited_node_ids = set()");
        sb.AppendLine("    while pending_node_ids:");
        sb.AppendLine("        current_node_id = pending_node_ids.pop(0)");
        sb.AppendLine("        if current_node_id in visited_node_ids:");
        sb.AppendLine("            continue");
        sb.AppendLine("        visited_node_ids.add(current_node_id)");

        bool appendedNodeBlock = false;
        foreach (WorkflowActionNodeModel node in workflow.Nodes)
        {
            string branchPrefix = appendedNodeBlock ? "        elif" : "        if";
            sb.AppendLine($"{branchPrefix} current_node_id == '{EscapePythonString(node.Id)}':");
            AppendNodeExecution(sb, node, generationContext, triggerComponent, components, "            ");
            appendedNodeBlock = true;
        }

        if (!appendedNodeBlock)
        {
            sb.AppendLine("        pass");
        }
        else
        {
            sb.AppendLine("        else:");
            sb.AppendLine("            workflow_state[current_node_id] = {'status': 'error', 'output': {}, 'error': f'Unknown workflow node: {current_node_id}'}");
        }

        sb.AppendLine("        current_result = workflow_state.get(current_node_id, {})");
        sb.AppendLine("        current_status = current_result.get('status', 'error')");
        sb.AppendLine("        allowed_routes = ['always', 'onSuccess'] if current_status == 'success' else ['always', 'onError']");
        sb.AppendLine("        for edge in edge_lookup.get(current_node_id, []):");
        sb.AppendLine("            if edge.get('route') not in allowed_routes:");
        sb.AppendLine("                continue");

        sb.AppendLine("            pending_node_ids.append(edge['toNodeId'])");
        sb.AppendLine("    for _vdab_wf_err_id, _vdab_wf_err_res in workflow_state.items():");
        sb.AppendLine("        if isinstance(_vdab_wf_err_res, dict) and _vdab_wf_err_res.get('status') == 'error':");
        sb.AppendLine("            _vdab_err_msg = str(_vdab_wf_err_res.get('error', 'Unknown error'))");
        sb.AppendLine("            _vdab_enqueue_toast(f\"Workflow failed at step '{_vdab_wf_err_id}': {_vdab_err_msg}\", icon=':material/error:')");
        sb.AppendLine($"    workflow_results['{EscapePythonString(workflow.CodeName)}'] = workflow_state");
        sb.AppendLine();
    }

    private List<string> GetStartNodeIds(WorkflowModel workflow)
    {
        HashSet<string> incomingNodeIds = workflow.Edges
            .Select(edge => edge.ToNodeId)
            .ToHashSet(StringComparer.Ordinal);

        List<string> startNodeIds = workflow.Nodes
            .Where(node => !incomingNodeIds.Contains(node.Id))
            .Select(node => node.Id)
            .ToList();

        if (startNodeIds.Count == 0 && workflow.Nodes.Count > 0)
        {
            startNodeIds.Add(workflow.Nodes[0].Id);
        }

        return startNodeIds;
    }

    private void AppendNodeExecution(
        StringBuilder sb,
        WorkflowActionNodeModel node,
        WorkflowActionGenerationContext generationContext,
        VdabComponentDto? triggerComponent,
        List<VdabComponentDto> components,
        string indentation)
    {
        switch (node)
        {
            case TriggerToastActionModel triggerToastNode:
                AppendTypedNodeExecution(sb, triggerToastNode, generationContext, triggerComponent, components, indentation);
                break;
            case ShowModalActionModel showModalNode:
                AppendTypedNodeExecution(sb, showModalNode, generationContext, triggerComponent, components, indentation);
                break;
            case SaveToTableActionModel saveToTableNode:
                AppendTypedNodeExecution(sb, saveToTableNode, generationContext, triggerComponent, components, indentation);
                break;
            case BuildSqlActionModel buildSqlNode:
                AppendTypedNodeExecution(sb, buildSqlNode, generationContext, triggerComponent, components, indentation);
                break;
            case RunSqlActionModel runSqlNode:
                AppendTypedNodeExecution(sb, runSqlNode, generationContext, triggerComponent, components, indentation);
                break;
            case SetBindingActionModel setBindingNode:
                AppendTypedNodeExecution(sb, setBindingNode, generationContext, triggerComponent, components, indentation);
                break;
            case StartDatabricksJobActionModel startDatabricksJobNode:
                AppendTypedNodeExecution(sb, startDatabricksJobNode, generationContext, triggerComponent, components, indentation);
                break;
            case CallCustomModuleActionModel callCustomModuleNode:
                AppendTypedNodeExecution(sb, callCustomModuleNode, generationContext, triggerComponent, components, indentation);
                break;
            case CallPrebuiltModuleActionModel callPrebuiltModuleNode:
                AppendTypedNodeExecution(sb, callPrebuiltModuleNode, generationContext, triggerComponent, components, indentation);
                break;
            default:
                AppendUnsupportedNodeExecution(sb, node, indentation);
                break;
        }
    }

    private void AppendTypedNodeExecution<TActionNode>(
        StringBuilder sb,
        TActionNode actionNode,
        WorkflowActionGenerationContext generationContext,
        VdabComponentDto? triggerComponent,
        List<VdabComponentDto> components,
        string indentation)
        where TActionNode : WorkflowActionNodeModel
    {
        WorkflowActionKind actionKind = actionNode.ActionType;
        sb.AppendLine($"{indentation}# {EscapePythonString(actionKind.ToString())}");

        IWorkflowActionGenerator? generator = _actionGenerators.FirstOrDefault(g =>
            g.ActionKind == actionKind &&
            g.ActionModelType == typeof(TActionNode));

        if (generator is IWorkflowActionGenerator<TActionNode> typedGenerator)
        {
            typedGenerator.AppendRuntimeExecution(sb, actionNode, generationContext, triggerComponent, components, indentation);
            return;
        }

        AppendUnsupportedNodeExecution(sb, actionNode, indentation);
    }

    private void AppendUnsupportedNodeExecution(
        StringBuilder sb,
        WorkflowActionNodeModel node,
        string indentation)
    {
        WorkflowActionKind actionKind = node.ActionType;
        string nodeId = EscapePythonString(node.Id);
        sb.AppendLine($"{indentation}# {EscapePythonString(actionKind.ToString())}");
        sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': 'Unsupported action: {EscapePythonString(actionKind.ToString())}'}}");
    }

    internal static string GetBindingTypeValue(SetBindingTargetType bindingType)
    {
        return bindingType switch
        {
            SetBindingTargetType.UnityCatalogTable => "unityCatalogTable",
            SetBindingTargetType.ChartData => "chartData",
            _ => throw new InvalidOperationException($"Unsupported SetBinding target type '{bindingType}'."),
        };
    }

    internal static string GetToastPresetDurationValue(ToastPresetDuration duration)
    {
        return duration switch
        {
            ToastPresetDuration.Short => "short",
            ToastPresetDuration.Long => "long",
            ToastPresetDuration.Infinite => "infinite",
            _ => throw new InvalidOperationException($"Unsupported toast preset duration '{duration}'."),
        };
    }

    private static string GetRouteValue(WorkflowRouteModel route)
    {
        return route switch
        {
            WorkflowRouteModel.OnSuccess => "onSuccess",
            WorkflowRouteModel.OnError => "onError",
            WorkflowRouteModel.Always => "always",
            _ => throw new InvalidOperationException($"Unsupported workflow route '{route}'."),
        };
    }

    public static string BuildPythonLiteral(object? value)
    {
        if (value == null)
        {
            return "None";
        }

        if (value is bool boolValue)
        {
            return boolValue ? "True" : "False";
        }

        if (value is string stringValue)
        {
            return BuildPythonStringLiteral(stringValue);
        }

        if (value is sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal)
        {
            return Convert.ToString(value, CultureInfo.InvariantCulture) ?? "None";
        }

        return BuildPythonStringLiteral(value.ToString() ?? string.Empty);
    }

    public static string BuildPythonStringLiteral(string value)
    {
        return $"'{EscapePythonString(value)}'";
    }

    public static string EscapePythonString(string value)
    {
        return value
            .Replace("\\", "\\\\")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n")
            .Replace("'", "\\'");
    }
}
