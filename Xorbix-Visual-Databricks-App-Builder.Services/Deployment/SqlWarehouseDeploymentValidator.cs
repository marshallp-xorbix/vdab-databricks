using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Deployment;

/// <summary>
/// Ensures a SQL warehouse app resource exists when Unity Catalog SQL bindings need it,
/// and resolves the resource key for generated <c>app.yaml</c>.
/// </summary>
public static class SqlWarehouseDeploymentValidator
{
    /// <summary>
    /// Validates App Settings and returns the SQL warehouse resource key to bind in <c>app.yaml</c>.
    /// When Unity Catalog SQL is not required, returns the preferred key without failing.
    /// </summary>
    public static async Task<Result<string>> ResolveResourceKeyAsync(
        Guid userId,
        Guid tenantId,
        int appId,
        IReadOnlyList<VdabComponentDto>? components,
        WorkflowDefinitionDto? workflowDefinition,
        IAppActionService appActionService,
        ILogger logger)
    {
        bool requiresUnitySql = RequiresUnitySqlWarehouse(components, workflowDefinition);
        if (!requiresUnitySql)
        {
            return Result.Ok(DatabricksAppsSqlWarehouseResource.DefaultResourceKey);
        }

        Result<DatabricksAppResponse> detailsResult = await appActionService.GetAppDetailsAsync(userId, tenantId, appId);
        if (detailsResult.IsFailed)
        {
            return Result.Fail<string>(detailsResult.Errors);
        }

        List<string> warehouseKeys = GetSqlWarehouseResourceKeys(detailsResult.ValueOrDefault);
        string? preferred = PreferWarehouseResourceKey(warehouseKeys);

        if (preferred == null)
        {
            logger.LogWarning(
                "Deploy blocked: Unity Catalog SQL requires a SQL warehouse app resource. AppId={AppId}",
                appId);
            return Result.Fail<string>(new BadRequestError(
                "This app queries Unity Catalog tables and needs a SQL warehouse app resource. " +
                "Open App Settings → App resources, add a SQL warehouse " +
                $"(resource key '{DatabricksAppsSqlWarehouseResource.DefaultResourceKey}' recommended), save, then deploy again. " +
                "Grant the app's service principal CAN USE on that warehouse and the required Unity Catalog privileges on bound tables."));
        }

        return Result.Ok(preferred);
    }

    /// <summary>
    /// True when generated Streamlit code will call Databricks SQL as the app service principal
    /// against Unity Catalog data (requires a bound SQL warehouse resource).
    /// </summary>
    public static bool RequiresUnitySqlWarehouse(
        IReadOnlyList<VdabComponentDto>? components,
        WorkflowDefinitionDto? workflowDefinition)
    {
        Result<WorkflowDefinitionModel> parsed = WorkflowDefinitionParser.Parse(workflowDefinition);
        WorkflowDefinitionModel model = parsed.IsSuccess ? parsed.Value : new WorkflowDefinitionModel();
        return RequiresUnitySqlWarehouse(components, model);
    }

    /// <summary>
    /// True when generated Streamlit code will call Databricks SQL as the app service principal
    /// against Unity Catalog data (requires a bound SQL warehouse resource).
    /// </summary>
    /// <remarks>
    /// Prefer this overload when the workflow is already parsed to avoid a second parse.
    /// </remarks>
    public static bool RequiresUnitySqlWarehouse(
        IReadOnlyList<VdabComponentDto>? components,
        WorkflowDefinitionModel workflowDefinition)
    {
        if (components != null)
        {
            foreach (VdabComponentDto component in components)
            {
                if (HasCompleteUnityCatalogBinding(component))
                {
                    return true;
                }
            }
        }

        foreach (WorkflowModel workflow in workflowDefinition.Workflows)
        {
            Dictionary<string, WorkflowActionNodeModel> nodesById = workflow.Nodes
                .Where(node => !string.IsNullOrWhiteSpace(node.Id))
                .ToDictionary(node => node.Id, StringComparer.Ordinal);

            foreach (SaveToTableActionModel saveToTable in workflow.Nodes.OfType<SaveToTableActionModel>())
            {
                if (saveToTable.TargetTable is UnityCatalogTableRef)
                {
                    return true;
                }
            }

            foreach (RunSqlActionModel runSql in workflow.Nodes.OfType<RunSqlActionModel>())
            {
                if (!nodesById.TryGetValue(runSql.Statement.NodeId, out WorkflowActionNodeModel? sourceNode)
                    || sourceNode is not BuildSqlActionModel buildSql)
                {
                    continue;
                }

                if (buildSql.SqlSourceKind == WorkflowSqlSourceKind.UnityCatalogTable)
                {
                    return true;
                }
            }
        }

        return false;
    }

    /// <summary>
    /// Mirrors chart/DataWindow emitters: UC SQL is emitted only when catalog, schema, and table are all set.
    /// </summary>
    private static bool HasCompleteUnityCatalogBinding(VdabComponentDto component)
    {
        if (component.Bindings == null
            || !component.Bindings.TryGetValue(WorkflowParserTokens.SqlSourceKind.UnityCatalogTable, out BindingDto? unityBinding)
            || unityBinding.Source?.Resource is not { } resource)
        {
            return false;
        }

        return !string.IsNullOrWhiteSpace(resource.Catalog)
            && !string.IsNullOrWhiteSpace(resource.Schema)
            && !string.IsNullOrWhiteSpace(resource.Table);
    }

    private static List<string> GetSqlWarehouseResourceKeys(DatabricksAppResponse? appDetails)
    {
        List<string> keys = new();
        if (appDetails?.AppSettings?.Resources == null)
        {
            return keys;
        }

        foreach (NormalizedAppResourceDto resource in appDetails.AppSettings.Resources)
        {
            if (!string.Equals(resource.Kind, DatabricksAppResourceKinds.SqlWarehouse, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            string name = resource.Name?.Trim() ?? string.Empty;
            if (!string.IsNullOrEmpty(name))
            {
                keys.Add(name);
            }
        }

        return keys;
    }

    private static string? PreferWarehouseResourceKey(IReadOnlyList<string> warehouseKeys)
    {
        if (warehouseKeys.Count == 0)
        {
            return null;
        }

        foreach (string key in warehouseKeys)
        {
            if (string.Equals(key, DatabricksAppsSqlWarehouseResource.DefaultResourceKey, StringComparison.Ordinal))
            {
                return key;
            }
        }

        return warehouseKeys[0];
    }
}
