using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

internal sealed class ChartBindingContext
{
    public ChartBindingContext(
        string catalog,
        string schema,
        string table,
        bool usesLakebase,
        string? lakebaseDatabase)
    {
        Catalog = catalog;
        Schema = schema;
        Table = table;
        UsesLakebase = usesLakebase;
        LakebaseDatabase = lakebaseDatabase;
    }

    public string Catalog { get; }

    public string Schema { get; }

    public string Table { get; }

    public bool UsesLakebase { get; }

    public string? LakebaseDatabase { get; }

    public string ResolvedCatalog => UsesLakebase
        ? (string.IsNullOrWhiteSpace(LakebaseDatabase) ? "databricks_postgres" : LakebaseDatabase)
        : Catalog;

    public string TableReference => UsesLakebase
        ? $"{Schema}.{Table}"
        : $"{ResolvedCatalog}.{Schema}.{Table}";
}

internal static class ChartQueryHelper
{
    public static string AppendChartDataOverridePrelude(
        StringBuilder sb,
        string indentation,
        VdabComponentDto component,
        string varName)
    {
        if (string.IsNullOrWhiteSpace(component.CodeName))
        {
            return indentation;
        }

        sb.AppendLine($"{indentation}{varName}_binding_override = binding_overrides.get('{component.CodeName}:chartData')");
        sb.AppendLine($"{indentation}if {varName}_binding_override is not None:");
        sb.AppendLine($"{indentation}    {varName}_data = _binding_override_to_dataframe({varName}_binding_override)");
        sb.AppendLine($"{indentation}else:");
        return indentation + "    ";
    }

    public static string? BuildGeneratedQuery(
        VdabComponentDto component,
        Func<ChartBindingContext, string?> generatedQueryFactory,
        out bool usesLakebase)
    {
        bool hasBinding = TryGetBindingContext(component, out ChartBindingContext? bindingContext);
        usesLakebase = hasBinding && bindingContext != null && bindingContext.UsesLakebase;

        if (!hasBinding || bindingContext == null)
        {
            return null;
        }

        return generatedQueryFactory(bindingContext);
    }

    private static bool TryGetBindingContext(
        VdabComponentDto component,
        out ChartBindingContext? bindingContext)
    {
        bindingContext = null;

        if (component.Bindings == null)
        {
            return false;
        }

        if (component.Bindings.TryGetValue("lakebaseAutoscaling", out var autoscalingBinding) &&
            autoscalingBinding.Source?.Resource != null)
        {
            string? catalog = autoscalingBinding.Source.Resource.Catalog;
            string? schema = autoscalingBinding.Source.Resource.Schema;
            string? table = autoscalingBinding.Source.Resource.Table;

            if (string.IsNullOrWhiteSpace(catalog) ||
                string.IsNullOrWhiteSpace(schema) ||
                string.IsNullOrWhiteSpace(table))
            {
                return false;
            }

            bindingContext = new ChartBindingContext(
                catalog,
                schema,
                table,
                true,
                autoscalingBinding.Source.Resource.Database);
            return true;
        }

        if (component.Bindings.TryGetValue("lakebaseProvisionedDatabase", out var lakebaseBinding) &&
            lakebaseBinding.Source?.Resource != null)
        {
            string? catalog = lakebaseBinding.Source.Resource.Catalog;
            string? schema = lakebaseBinding.Source.Resource.Schema;
            string? table = lakebaseBinding.Source.Resource.Table;

            if (string.IsNullOrWhiteSpace(catalog) ||
                string.IsNullOrWhiteSpace(schema) ||
                string.IsNullOrWhiteSpace(table))
            {
                return false;
            }

            bindingContext = new ChartBindingContext(
                catalog,
                schema,
                table,
                true,
                lakebaseBinding.Source.Resource.Database);
            return true;
        }

        if (component.Bindings.TryGetValue("unityCatalogTable", out var unityBinding) &&
            unityBinding.Source?.Resource != null)
        {
            string? catalog = unityBinding.Source.Resource.Catalog;
            string? schema = unityBinding.Source.Resource.Schema;
            string? table = unityBinding.Source.Resource.Table;

            if (string.IsNullOrWhiteSpace(catalog) ||
                string.IsNullOrWhiteSpace(schema) ||
                string.IsNullOrWhiteSpace(table))
            {
                return false;
            }

            bindingContext = new ChartBindingContext(
                catalog,
                schema,
                table,
                false,
                null);
            return true;
        }

        return false;
    }
}
