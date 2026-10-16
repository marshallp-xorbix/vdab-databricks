using System.ComponentModel;
using System.Text.Json;
using Microsoft.SemanticKernel;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

internal sealed partial class CanvasToolPlugin
{
    [KernelFunction]
    [Description("Create a new workflow triggered by a component event. Call this before adding any actions.")]
    public string CreateWorkflow(
        [Description("Unique camelCase workflow name")] string workflowCodeName,
        [Description("The codeName of the component that triggers the workflow")] string triggerComponentCodeName,
        [Description("The event key on the trigger component: onClick, onChange, or onSubmit")] string triggerEventKey)
    {
        if (_pendingWorkflows.ContainsKey(workflowCodeName))
            throw new InvalidOperationException($"Workflow '{workflowCodeName}' already exists. Choose a different codeName.");

        if (_existingWorkflowByCodeName.ContainsKey(workflowCodeName))
            throw new InvalidOperationException($"Workflow '{workflowCodeName}' already exists. Call deleteWorkflow first before recreating it.");

        string triggerKey = AiBuilderWorkflowKeys.BuildTriggerKey(triggerComponentCodeName, triggerEventKey);
        if (_workflowTriggerKeys.Contains(triggerKey))
            throw new InvalidOperationException($"A workflow already exists for {triggerComponentCodeName}.{triggerEventKey}. Delete it before creating a replacement.");

        WorkflowDto workflow = new()
        {
            CodeName = workflowCodeName,
            Trigger = new WorkflowTriggerDto
            {
                ComponentCodeName = triggerComponentCodeName,
                EventKey = triggerEventKey,
            },
        };
        _pendingWorkflows[workflowCodeName] = workflow;
        _workflowTriggerKeys.Add(triggerKey);
        return workflowCodeName;
    }

    [KernelFunction]
    [Description("Add a toast notification action to a workflow.")]
    public string AddTriggerToastAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'toast1'")] string nodeId,
        [Description("Text shown in the toast notification")] string body,
        [Description("Duration: short (default), long, or infinite")] string toastDuration = "short")
    {
        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "TriggerToast",
            SchemaVersion = 1,
            Params = new { body, duration = new { kind = "preset", value = toastDuration } },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action to open a modal dialog.")]
    public string AddShowModalAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'showModal1'")] string nodeId,
        [Description("The codeName of the modal component to open")] string modalCodeName)
    {
        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "ShowModal",
            SchemaVersion = 1,
            Params = new { modalCodeName },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action to build a parameterized SQL query. Chain with AddRunSqlAction to execute it.")]
    public string AddBuildSqlAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'buildSql1'")] string nodeId,
        [Description("SQL template with optional {{token}} placeholders")] string sqlTemplate,
        [Description("Data source kind: unityCatalogTable (default), lakebaseProvisionedDatabase, or lakebaseAutoscaling")] string sqlSourceKind = "unityCatalogTable",
        [Description("JSON array of placeholder refs: [{token, componentCodeName, valueType, formatHint}]")] string placeholdersJson = "[]")
    {
        List<PlaceholderRefDto> placeholders = Deserialize<List<PlaceholderRefDto>>(placeholdersJson) ?? [];

        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "BuildSql",
            SchemaVersion = 1,
            Params = new { sqlSourceKind, sqlTemplate, placeholders },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action to run the SQL produced by a preceding BuildSql node.")]
    public string AddRunSqlAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'runSql1'")] string nodeId,
        [Description("The node id of the BuildSql action to execute")] string buildSqlNodeId)
    {
        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "RunSql",
            SchemaVersion = 1,
            Params = new { statement = new { sourceActionType = "BuildSql", nodeId = buildSqlNodeId } },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action to bind RunSql results into a DataWindow or chart component.")]
    public string AddSetBindingAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'setBinding1'")] string nodeId,
        [Description("The node id of the RunSql action whose rows to bind")] string runSqlNodeId,
        [Description("The codeName of the DataWindow or chart to populate")] string targetComponentCodeName,
        [Description("Binding type: unityCatalogTable (default) or chartData")] string bindingType = "unityCatalogTable")
    {
        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "SetBinding",
            SchemaVersion = 1,
            Params = new
            {
                source = new { sourceActionType = "RunSql", nodeId = runSqlNodeId, outputKey = "rows" },
                target = new { componentCodeName = targetComponentCodeName, bindingType },
            },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action to save a form's submitted data to a Unity Catalog table.")]
    public string AddSaveToTableAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'saveTable1'")] string nodeId,
        [Description("The codeName of the Form component whose data to save")] string sourceFormComponentCodeName,
        [Description("Unity Catalog catalog name")] string catalog,
        [Description("Unity Catalog schema name")] string schema,
        [Description("Unity Catalog table name")] string table)
    {
        if (_workspaceConnectionId <= 0)
            throw new InvalidOperationException("No workspace connection is configured. Cannot add SaveToTable action.");

        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "SaveToTable",
            SchemaVersion = 1,
            Params = new
            {
                sourceFormComponentCodeName,
                targetTable = new
                {
                    tableType = "unityCatalogTable",
                    workspaceConnectionId = _workspaceConnectionId,
                    catalog,
                    schema,
                    table,
                },
                excludedColumns = Array.Empty<object>(),
                columnMappings = Array.Empty<object>(),
            },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action to save a form's submitted data to a Lakebase Provisioned database table.")]
    public string AddSaveToLakebaseProvisionedAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'saveLakebase1'")] string nodeId,
        [Description("The codeName of the Form component whose data to save")] string sourceFormComponentCodeName,
        [Description("Lakebase instance name (from AVAILABLE LAKEBASE PROVISIONED INSTANCES)")] string instanceName,
        [Description("Lakebase database name")] string database,
        [Description("Catalog name")] string catalog,
        [Description("Schema name")] string schema,
        [Description("Table name")] string table)
    {
        if (_workspaceConnectionId <= 0)
            throw new InvalidOperationException("No workspace connection is configured. Cannot add SaveToLakebaseProvisioned action.");
        if (string.IsNullOrWhiteSpace(instanceName) || string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(schema) || string.IsNullOrWhiteSpace(table))
            throw new InvalidOperationException("instanceName, database, schema, and table are required. Ask the user to provide any missing values before calling this tool.");

        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "SaveToTable",
            SchemaVersion = 1,
            Params = new
            {
                sourceFormComponentCodeName,
                targetTable = new
                {
                    tableType = "lakebaseProvisionedDatabase",
                    workspaceConnectionId = _workspaceConnectionId,
                    instanceName,
                    database,
                    catalog,
                    schema,
                    table,
                },
                excludedColumns = Array.Empty<object>(),
                columnMappings = Array.Empty<object>(),
            },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action to save a form's submitted data to a Lakebase Autoscaling table.")]
    public string AddSaveToLakebaseAutoscalingAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'saveLakebaseAuto1'")] string nodeId,
        [Description("The codeName of the Form component whose data to save")] string sourceFormComponentCodeName,
        [Description("Project id (from AVAILABLE LAKEBASE AUTOSCALING ENDPOINTS)")] string projectId,
        [Description("Branch id")] string branchId,
        [Description("Endpoint id")] string endpointId,
        [Description("Database name")] string database,
        [Description("Catalog name")] string catalog,
        [Description("Schema name")] string schema,
        [Description("Table name")] string table)
    {
        if (_workspaceConnectionId <= 0)
            throw new InvalidOperationException("No workspace connection is configured. Cannot add SaveToLakebaseAutoscaling action.");
        if (string.IsNullOrWhiteSpace(projectId) || string.IsNullOrWhiteSpace(branchId) || string.IsNullOrWhiteSpace(endpointId) || string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(schema) || string.IsNullOrWhiteSpace(table))
            throw new InvalidOperationException("projectId, branchId, endpointId, database, schema, and table are required. Ask the user to provide any missing values before calling this tool.");

        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "SaveToTable",
            SchemaVersion = 1,
            Params = new
            {
                sourceFormComponentCodeName,
                targetTable = new
                {
                    tableType = "lakebaseAutoscaling",
                    workspaceConnectionId = _workspaceConnectionId,
                    projectId,
                    branchId,
                    endpointId,
                    database,
                    catalog,
                    schema,
                    table,
                },
                excludedColumns = Array.Empty<object>(),
                columnMappings = Array.Empty<object>(),
            },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action to trigger a Databricks job run.")]
    public string AddStartDatabricksJobAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'startJob1'")] string nodeId,
        [Description("Databricks job id (from AVAILABLE DATABRICKS JOBS)")] string jobId,
        [Description("Databricks job name")] string jobName)
    {
        if (_workspaceConnectionId <= 0)
            throw new InvalidOperationException("No workspace connection is configured. Cannot add StartDatabricksJob action.");

        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "StartDatabricksJob",
            SchemaVersion = 1,
            Params = new
            {
                job = new
                {
                    resourceType = "databricksJob",
                    workspaceConnectionId = _workspaceConnectionId,
                    jobId,
                    jobName,
                },
            },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action that calls an existing top-level function from custom_modules.py. The function must accept ctx as its first parameter.")]
    public string AddCallCustomModuleAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'customModule1'")] string nodeId,
        [Description("Top-level function name from custom_modules.py")] string functionName)
    {
        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "CallCustomModule",
            SchemaVersion = 1,
            Params = new { functionName },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Add an action that calls a curated function from prebuilt_modules_library.py. namedArgumentsJson must include every parameter after ctx.")]
    public string AddCallPrebuiltModuleAction(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("Unique node id within the workflow, e.g. 'prebuiltModule1'")] string nodeId,
        [Description("Function name from PREBUILT MODULE FUNCTIONS")] string functionName,
        [Description("JSON object of string arguments keyed by parameter name, e.g. {\"component\":\"statusLabel\",\"new_label\":\"Done\"}")] string namedArgumentsJson = "{}")
    {
        Dictionary<string, string> namedArguments = Deserialize<Dictionary<string, string>>(namedArgumentsJson) ?? [];
        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Nodes.Add(new WorkflowActionNodeDto
        {
            Id = nodeId,
            ActionType = "CallPrebuiltModule",
            SchemaVersion = 1,
            Params = new { functionName, namedArguments },
        });
        return nodeId;
    }

    [KernelFunction]
    [Description("Connect two workflow action nodes in sequence.")]
    public string ConnectWorkflowNodes(
        [Description("Workflow codeName")] string workflowCodeName,
        [Description("The source node id")] string fromNodeId,
        [Description("The destination node id")] string toNodeId,
        [Description("Route: onSuccess (default), onError, or always")] string route = "onSuccess")
    {
        WorkflowDto workflow = ResolveWorkflow(workflowCodeName);
        workflow.Edges.Add(new WorkflowEdgeDto
        {
            FromNodeId = fromNodeId,
            ToNodeId = toNodeId,
            Route = route,
        });
        return $"{fromNodeId}->{toNodeId}";
    }

    [KernelFunction]
    [Description("Delete an existing workflow by its codeName.")]
    public string DeleteWorkflow(
        [Description("The codeName of the workflow to delete")] string workflowCodeName)
    {
        if (_pendingWorkflows.Remove(workflowCodeName, out WorkflowDto? pendingWorkflow))
        {
            _workflowTriggerKeys.Remove(AiBuilderWorkflowKeys.BuildTriggerKey(pendingWorkflow.Trigger.ComponentCodeName, pendingWorkflow.Trigger.EventKey));
        }

        if (_existingWorkflowByCodeName.Remove(workflowCodeName, out WorkflowSummaryDto? existingWorkflow))
        {
            _workflowTriggerKeys.Remove(AiBuilderWorkflowKeys.BuildTriggerKey(existingWorkflow.TriggerComponentCodeName, existingWorkflow.TriggerEventKey));
        }

        _operations.Add(new CanvasOperationDto { Op = "deleteWorkflow", ComponentId = workflowCodeName });
        return workflowCodeName;
    }

    private WorkflowDto ResolveWorkflow(string workflowCodeName)
    {
        if (!_pendingWorkflows.TryGetValue(workflowCodeName, out WorkflowDto? workflow))
            throw new InvalidOperationException($"Workflow '{workflowCodeName}' not found. Call createWorkflow first.");
        return workflow;
    }
}
