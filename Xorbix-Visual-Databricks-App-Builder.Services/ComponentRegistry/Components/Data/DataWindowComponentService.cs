using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Data;

/// <summary>
/// Service for DataWindow component
/// </summary>
public class DataWindowComponentService : BaseComponentService, IDataWindowComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.DataWindow;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new DataWindowComponentDto
        {
            Id = "template-datawindow",
            CodeName = "templateDataWindow",
            Type = ComponentType.DataWindow,
            Category = ComponentCategory.Data,
            Icon = "Table",
            SchemaVersion = 1,
            Props = new DataWindowProps
            {
                Label = "Data Table",
                MaxRows = 0,
                Scrollable = true,
                Placeholder = null,
                Width = "stretch",
                HideIndex = null,
                Height = "auto"
            },
            SupportedBindings = new List<string> { "unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling" }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        DataWindowComponentDto dataWindow = (DataWindowComponentDto)component;

        string varName = GetVariableName(component);
        string label = dataWindow.Props.Label!;
        string codeName = component.CodeName?.Trim() ?? varName;
        int maxRows = dataWindow.Props.MaxRows;
        string width = dataWindow.Props.Width;
        string height = dataWindow.Props.Height;
        string? placeholder = dataWindow.Props.Placeholder;
        bool? hideIndex = dataWindow.Props.HideIndex;
        string dataIndentation = indentation;
        string? bindingType = null;
        List<Dictionary<string, object?>> columnsMetadata = new List<Dictionary<string, object?>>();
        if (component.Bindings != null && component.Bindings.ContainsKey("lakebaseAutoscaling"))
        {
            bindingType = "lakebaseAutoscaling";
        }
        else if (component.Bindings != null && component.Bindings.ContainsKey("lakebaseProvisionedDatabase"))
        {
            bindingType = "lakebaseProvisionedDatabase";
        }
        else if (component.Bindings != null && component.Bindings.ContainsKey("unityCatalogTable"))
        {
            bindingType = "unityCatalogTable";
        }

        if (!string.IsNullOrWhiteSpace(component.CodeName) && !string.IsNullOrWhiteSpace(bindingType))
        {
            sb.AppendLine($"{indentation}{varName}_binding_override = binding_overrides.get('{component.CodeName}:{bindingType}')");
            sb.AppendLine($"{indentation}if {varName}_binding_override is not None:");
            sb.AppendLine($"{indentation}    {varName}_data = _binding_override_to_dataframe({varName}_binding_override)");
            sb.AppendLine($"{indentation}else:");
            dataIndentation += "    ";
        }

        // Extract table info from bindings
        string? catalog = null;
        string? schema = null;
        string? table = null;

        bool usesLakebase = false;
        string? lakebaseDatabase = null;
        if (component.Bindings != null && component.Bindings.TryGetValue("lakebaseAutoscaling", out var autoscalingBinding))
        {
            if (autoscalingBinding.Source?.Resource != null)
            {
                catalog = autoscalingBinding.Source.Resource.Catalog;
                schema = autoscalingBinding.Source.Resource.Schema;
                table = autoscalingBinding.Source.Resource.Table;
                lakebaseDatabase = autoscalingBinding.Source.Resource.Database;
                columnsMetadata = autoscalingBinding.Source.Resource.Columns ?? new List<Dictionary<string, object?>>();
                usesLakebase = true;
            }
        }
        else if (component.Bindings != null && component.Bindings.TryGetValue("lakebaseProvisionedDatabase", out var lakebaseBinding))
        {
            if (lakebaseBinding.Source?.Resource != null)
            {
                catalog = lakebaseBinding.Source.Resource.Catalog;
                schema = lakebaseBinding.Source.Resource.Schema;
                table = lakebaseBinding.Source.Resource.Table;
                lakebaseDatabase = lakebaseBinding.Source.Resource.Database;
                columnsMetadata = lakebaseBinding.Source.Resource.Columns ?? new List<Dictionary<string, object?>>();
                usesLakebase = true;
            }
        }
        else if (component.Bindings != null && component.Bindings.TryGetValue("unityCatalogTable", out var binding))
        {
            if (binding.Source?.Resource != null)
            {
                catalog = binding.Source.Resource.Catalog;
                schema = binding.Source.Resource.Schema;
                table = binding.Source.Resource.Table;
                columnsMetadata = binding.Source.Resource.Columns ?? new List<Dictionary<string, object?>>();
            }
        }

        // Construct the table reference if all parts are provided.
        // Lakebase/Postgres queries run against the selected database connection already,
        // so they should reference schema.table instead of catalog.schema.table.
        if (!string.IsNullOrWhiteSpace(catalog) && !string.IsNullOrWhiteSpace(schema) && !string.IsNullOrWhiteSpace(table))
        {
            if (usesLakebase)
            {
                catalog = string.IsNullOrWhiteSpace(lakebaseDatabase) ? "databricks_postgres" : lakebaseDatabase;
            }

            var tableReference = usesLakebase
                ? $"{schema}.{table}"
                : $"{catalog}.{schema}.{table}";
            string selectQuery = maxRows > 0
                ? $"SELECT * FROM {tableReference} LIMIT {maxRows}"
                : $"SELECT * FROM {tableReference}";
            if (usesLakebase)
            {
                sb.AppendLine($"{dataIndentation}# Fetch data from Lakebase table: {tableReference}");
                sb.AppendLine($"{dataIndentation}{varName}_data = lakebase_query_df('{selectQuery}')");
            }
            else
            {
                sb.AppendLine($"{dataIndentation}# Fetch data from Unity Catalog table: {tableReference}");
                sb.AppendLine($"{dataIndentation}{varName}_data = sql_query_df('{selectQuery}')");
            }
        }
        else
        {
            sb.AppendLine($"{dataIndentation}# No complete table reference specified (catalog, schema, or table missing), generating schema-only empty dataframe");
            if (columnsMetadata.Count == 0)
            {
                sb.AppendLine($"{dataIndentation}{varName}_data = pd.DataFrame()");
            }
            else
            {
                sb.AppendLine($"{dataIndentation}{varName}_data = pd.DataFrame(columns=[");
                foreach (Dictionary<string, object?> column in columnsMetadata)
                {
                    string? columnName = ReadColumnName(column);
                    if (!string.IsNullOrWhiteSpace(columnName))
                    {
                        sb.AppendLine($"{dataIndentation}    '{EscapePythonString(columnName)}',");
                    }
                }
                sb.AppendLine($"{dataIndentation}])");
            }
        }

        sb.AppendLine($"{indentation}{varName}_column_config = {{");
        foreach (Dictionary<string, object?> column in columnsMetadata)
        {
            string? columnName = ReadColumnName(column);
            if (string.IsNullOrWhiteSpace(columnName))
            {
                continue;
            }

            string? columnType = ReadColumnType(column);
            string displayLabel = string.IsNullOrWhiteSpace(columnType)
                ? columnName
                : $"{columnName} ({columnType})";
            sb.AppendLine($"{indentation}    '{EscapePythonString(columnName)}': '{EscapePythonString(displayLabel)}',");
        }
        sb.AppendLine($"{indentation}}}");

        sb.AppendLine($"{indentation}");
        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        sb.AppendLine($"{indentation}st.subheader(_vdab_disp_lbl_{varName})");
        sb.AppendLine(
            $"{indentation}st.dataframe({varName}_data, width='{EscapePythonString(width)}', height='{EscapePythonString(height)}', hide_index={ToPythonNullableBool(hideIndex)}, column_config={varName}_column_config, placeholder={ToPythonNullableStringLiteral(placeholder)})");

        return sb.ToString().TrimEnd();
    }

    private static string? ReadColumnName(Dictionary<string, object?> column)
    {
        if (column.TryGetValue("name", out object? nameValue))
        {
            return nameValue?.ToString();
        }

        return null;
    }

    private static string? ReadColumnType(Dictionary<string, object?> column)
    {
        if (column.TryGetValue("type", out object? typeValue))
        {
            return typeValue?.ToString();
        }

        return null;
    }

    private static string EscapePythonString(string value) => value.Replace("\\", "\\\\").Replace("'", "\\'");

    private static string ToPythonNullableBool(bool? value)
    {
        if (!value.HasValue)
        {
            return "None";
        }

        return value.Value ? "True" : "False";
    }

    private static string ToPythonNullableStringLiteral(string? value)
    {
        if (value is null)
        {
            return "None";
        }

        return $"'{EscapePythonString(value)}'";
    }
}
