using System.Text.Json;
using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

/// <summary>
/// Validates chart **value** axes (line/bar Y, pie/donut Value): field + transform vs column type,
/// matching generated Streamlit (<c>pd.to_numeric</c>) and SQL aggregates.
/// </summary>
internal static class ChartValueAxisValidator
{
    /// <summary>
    /// Validates the value axis for chart components that bind a measure when bindings include column types.
    /// </summary>
    public static Result ValidateValueAxisForUpsert(
        ComponentType componentType,
        string propertiesJson,
        string? bindingsJson)
    {
        if (componentType is not (ComponentType.LineChart
            or ComponentType.BarChart
            or ComponentType.PieChart
            or ComponentType.DonutChart))
        {
            return Result.Ok();
        }

        ChartAxisConfigDto? axis;
        try
        {
            JsonSerializerOptions options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            axis = componentType switch
            {
                ComponentType.LineChart => JsonSerializer.Deserialize<LineChartProps>(propertiesJson, options)?.YAxis,
                ComponentType.BarChart => JsonSerializer.Deserialize<BarChartProps>(propertiesJson, options)?.YAxis,
                ComponentType.PieChart => JsonSerializer.Deserialize<PieChartProps>(propertiesJson, options)?.Value,
                ComponentType.DonutChart => JsonSerializer.Deserialize<DonutChartProps>(propertiesJson, options)?.Value,
                _ => null
            };
        }
        catch (JsonException)
        {
            return Result.Fail(new BadRequestError("Chart properties JSON is invalid. Check the chart configuration in the builder."));
        }

        if (axis == null)
        {
            return Result.Fail(new BadRequestError(GetMissingAxisConfigurationMessage(componentType)));
        }

        string transform = string.IsNullOrWhiteSpace(axis.Transform) ? "none" : axis.Transform.Trim().ToLowerInvariant();
        bool hasField = !string.IsNullOrWhiteSpace(axis.Field);

        if (componentType == ComponentType.BarChart && transform == "count" && !hasField)
        {
            return Result.Ok();
        }

        if (!hasField)
        {
            return Result.Fail(new BadRequestError(GetMissingFieldMessage(componentType)));
        }

        Dictionary<string, string>? columnTypes = TryParseColumnTypesFromBindings(bindingsJson);
        if (columnTypes == null
            || !columnTypes.TryGetValue(axis.Field!, out string? sparkType)
            || string.IsNullOrWhiteSpace(sparkType))
        {
            return Result.Ok();
        }

        string category = ChartColumnTypeCategoryHelper.GetCategory(sparkType);
        if (!IsMeasureTransformAllowedForCategory(category, transform))
        {
            string hint = category switch
            {
                "string" or "boolean" => "For text or boolean columns, use COUNT or COUNT DISTINCT (not raw values).",
                "temporal" => "For date/time columns, use COUNT, COUNT DISTINCT, MIN, or MAX — not raw values.",
                "unknown" => "Choose COUNT or COUNT DISTINCT, or bind a table so column types can be validated.",
                _ => "Use a transform that produces a numeric measure."
            };

            string axisLabel = componentType is ComponentType.PieChart or ComponentType.DonutChart
                ? "Value"
                : "Y";

            return Result.Fail(new BadRequestError(
                $"{axisLabel} axis: column '{axis.Field}' cannot use transform '{transform}' with this chart type. {hint}"));
        }

        return Result.Ok();
    }

    private static string GetMissingAxisConfigurationMessage(ComponentType componentType)
    {
        return componentType switch
        {
            ComponentType.LineChart => "Line chart is missing Y axis configuration.",
            ComponentType.BarChart => "Bar chart is missing Y axis configuration.",
            ComponentType.PieChart => "Pie chart is missing Value axis configuration.",
            ComponentType.DonutChart => "Donut chart is missing Value axis configuration.",
            _ => "Chart is missing value axis configuration."
        };
    }

    private static string GetMissingFieldMessage(ComponentType componentType)
    {
        return componentType switch
        {
            ComponentType.LineChart => "Line chart requires a Y axis column.",
            ComponentType.BarChart => "Bar chart Y axis needs a column, or use COUNT with no column for COUNT(*).",
            ComponentType.PieChart => "Pie chart requires a Value column.",
            ComponentType.DonutChart => "Donut chart requires a Value column.",
            _ => "Chart requires a value column."
        };
    }

    private static bool IsMeasureTransformAllowedForCategory(string category, string transform)
    {
        return category switch
        {
            "numeric" => transform is "none" or "sum" or "avg" or "min" or "max" or "count" or "count_distinct",
            "temporal" => transform is "count" or "count_distinct" or "min" or "max",
            "string" or "boolean" => transform is "count" or "count_distinct",
            "unknown" => transform is "count" or "count_distinct",
            _ => transform is "count" or "count_distinct"
        };
    }

    private static Dictionary<string, string>? TryParseColumnTypesFromBindings(string? bindingsJson)
    {
        if (string.IsNullOrWhiteSpace(bindingsJson))
        {
            return null;
        }

        try
        {
            using JsonDocument doc = JsonDocument.Parse(bindingsJson);
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            Dictionary<string, string> map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (JsonProperty prop in root.EnumerateObject())
            {
                TryAddColumnsFromBinding(prop.Value, map);
            }

            return map.Count > 0 ? map : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static void TryAddColumnsFromBinding(JsonElement bindingObj, Dictionary<string, string> map)
    {
        if (bindingObj.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        if (!bindingObj.TryGetProperty("source", out JsonElement source))
        {
            return;
        }

        if (!source.TryGetProperty("resource", out JsonElement resource))
        {
            return;
        }

        if (!resource.TryGetProperty("columns", out JsonElement columns) || columns.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (JsonElement col in columns.EnumerateArray())
        {
            if (col.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (!col.TryGetProperty("name", out JsonElement nameEl))
            {
                continue;
            }

            string? name = nameEl.GetString();
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            string type = "";
            if (col.TryGetProperty("type", out JsonElement typeEl))
            {
                type = typeEl.GetString() ?? "";
            }

            map[name] = type;
        }
    }
}
