using System.ComponentModel;
using Microsoft.SemanticKernel;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

internal sealed partial class CanvasToolPlugin
{
    [KernelFunction]
    [Description("Bind a FileUpload component to a Databricks Volume so uploaded files are stored there.")]
    public string SetStaticVolumeBinding(
        [Description("The codeName of the FileUpload component to bind")] string componentCodeName,
        [Description("Unity Catalog catalog name")] string catalog,
        [Description("Unity Catalog schema name")] string schema,
        [Description("Unity Catalog volume name")] string volume,
        [Description("Optional subfolder within the volume, e.g. /uploads")] string? filePath = null)
    {
        if (string.IsNullOrWhiteSpace(catalog) || string.IsNullOrWhiteSpace(schema) || string.IsNullOrWhiteSpace(volume))
            throw new InvalidOperationException("catalog, schema, and volume are required. Only call this tool when AVAILABLE UNITY CATALOG TABLES is present in context.");
        string componentId = ResolveComponentId(string.Empty, componentCodeName);
        Dictionary<string, BindingDto> bindings = new()
        {
            ["databricksVolume"] = new BindingDto
            {
                BindingType = "databricksVolume",
                Source = new BindingSourceDto
                {
                    Kind = "resource",
                    Resource = new ResourceBindingSourceDto
                    {
                        Type = "databricksVolume",
                        Catalog = catalog,
                        Schema = schema,
                        Volume = volume,
                        FilePath = filePath,
                    },
                },
            },
        };
        _operations.Add(new CanvasOperationDto { Op = "setBindings", ComponentId = componentId, Bindings = bindings });
        return componentId;
    }

    [KernelFunction]
    [Description("Bind a DataWindow, EditableDataWindow, chart, or story visualization to a Unity Catalog table so it loads data on startup.")]
    public string SetStaticUnityCatalogBinding(
        [Description("The codeName of the component to bind")] string componentCodeName,
        [Description("Unity Catalog catalog name")] string catalog,
        [Description("Unity Catalog schema name")] string schema,
        [Description("Unity Catalog table name")] string table)
    {
        if (string.IsNullOrWhiteSpace(catalog) || string.IsNullOrWhiteSpace(schema) || string.IsNullOrWhiteSpace(table))
            throw new InvalidOperationException("catalog, schema, and table are required. Only call this tool when AVAILABLE UNITY CATALOG TABLES is present in context.");
        string componentId = ResolveComponentId(string.Empty, componentCodeName);
        Dictionary<string, BindingDto> bindings = new()
        {
            ["unityCatalogTable"] = new BindingDto
            {
                BindingType = "unityCatalogTable",
                Source = new BindingSourceDto
                {
                    Kind = "resource",
                    Resource = new ResourceBindingSourceDto
                    {
                        Type = "unityCatalogTable",
                        Catalog = catalog,
                        Schema = schema,
                        Table = table,
                    },
                },
            },
        };
        _operations.Add(new CanvasOperationDto { Op = "setBindings", ComponentId = componentId, Bindings = bindings });
        return componentId;
    }

    [KernelFunction]
    [Description("Bind a DataWindow, EditableDataWindow, chart, or story visualization to a Lakebase Provisioned database table so it loads data on startup.")]
    public string SetStaticLakebaseProvisionedBinding(
        [Description("The codeName of the component to bind")] string componentCodeName,
        [Description("Lakebase instance name (from AVAILABLE LAKEBASE PROVISIONED INSTANCES)")] string instanceName,
        [Description("Lakebase database name")] string database,
        [Description("Catalog name")] string catalog,
        [Description("Schema name")] string schema,
        [Description("Table name")] string table)
    {
        if (string.IsNullOrWhiteSpace(instanceName) || string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(table))
            throw new InvalidOperationException("instanceName, database, and table are required. Only call this tool when AVAILABLE LAKEBASE PROVISIONED INSTANCES is present in context.");
        string componentId = ResolveComponentId(string.Empty, componentCodeName);
        Dictionary<string, BindingDto> bindings = new()
        {
            ["lakebaseProvisionedDatabase"] = new BindingDto
            {
                BindingType = "lakebaseProvisionedDatabase",
                Source = new BindingSourceDto
                {
                    Kind = "resource",
                    Resource = new ResourceBindingSourceDto
                    {
                        Type = "lakebaseProvisionedDatabase",
                        InstanceName = instanceName,
                        Database = database,
                        Catalog = catalog,
                        Schema = schema,
                        Table = table,
                    },
                },
            },
        };
        _operations.Add(new CanvasOperationDto { Op = "setBindings", ComponentId = componentId, Bindings = bindings });
        return componentId;
    }

    [KernelFunction]
    [Description("Bind a DataWindow, EditableDataWindow, chart, or story visualization to a Lakebase Autoscaling table so it loads data on startup.")]
    public string SetStaticLakebaseAutoscalingBinding(
        [Description("The codeName of the component to bind")] string componentCodeName,
        [Description("Project id (from AVAILABLE LAKEBASE AUTOSCALING ENDPOINTS)")] string projectId,
        [Description("Branch id")] string branchId,
        [Description("Endpoint id")] string endpointId,
        [Description("Database name")] string database,
        [Description("Catalog name")] string catalog,
        [Description("Schema name")] string schema,
        [Description("Table name")] string table)
    {
        if (string.IsNullOrWhiteSpace(projectId) || string.IsNullOrWhiteSpace(branchId) || string.IsNullOrWhiteSpace(endpointId) || string.IsNullOrWhiteSpace(table))
            throw new InvalidOperationException("projectId, branchId, endpointId, and table are required. Only call this tool when AVAILABLE LAKEBASE AUTOSCALING ENDPOINTS is present in context.");
        string componentId = ResolveComponentId(string.Empty, componentCodeName);
        Dictionary<string, BindingDto> bindings = new()
        {
            ["lakebaseAutoscaling"] = new BindingDto
            {
                BindingType = "lakebaseAutoscaling",
                Source = new BindingSourceDto
                {
                    Kind = "resource",
                    Resource = new ResourceBindingSourceDto
                    {
                        Type = "lakebaseAutoscaling",
                        ProjectId = projectId,
                        BranchId = branchId,
                        EndpointId = endpointId,
                        Database = database,
                        Catalog = catalog,
                        Schema = schema,
                        Table = table,
                    },
                },
            },
        };
        _operations.Add(new CanvasOperationDto { Op = "setBindings", ComponentId = componentId, Bindings = bindings });
        return componentId;
    }
}
