using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Builds normalized <see cref="AppSettingsDetailsDto"/> from Databricks app JSON, including unknown-type warnings.
/// Autoscaling lakebase is represented as <c>autoscaling_database</c> or <c>postgres</c> with a <c>branch</c> field;
/// generic <c>database</c> and legacy <c>postgres</c> objects without <c>branch</c> stay <see cref="DatabricksAppResourceKinds.Database"/>.
/// </summary>
public static class AppSettingsDetailsMapper
{
    /// <summary>
    /// Maps <paramref name="root"/> to App Settings (resources, compute size, warnings).
    /// </summary>
    public static AppSettingsDetailsDto MapFromRoot(JsonElement root, JsonSerializerOptions options)
    {
        string computeSize = string.Empty;
        if (root.TryGetProperty("compute_size", out JsonElement computeSizeEl))
        {
            computeSize = computeSizeEl.GetString() ?? string.Empty;
        }

        List<NormalizedAppResourceDto> resources = new();
        List<AppSettingsWarningDto> warnings = new();

        if (!root.TryGetProperty("resources", out JsonElement resourcesEl) || resourcesEl.ValueKind != JsonValueKind.Array)
        {
            return new AppSettingsDetailsDto
            {
                ComputeSize = computeSize,
                Resources = resources,
                Warnings = warnings
            };
        }

        int index = 0;
        foreach (JsonElement item in resourcesEl.EnumerateArray())
        {
            string name = ReadStringProperty(item, "name");
            string description = ReadStringProperty(item, "description");

            foreach (JsonProperty prop in item.EnumerateObject())
            {
                string key = prop.Name;
                if (key == "name" || key == "description")
                {
                    continue;
                }

                if (DatabricksAppResourceKinds.KnownKinds.Contains(key)
                    || string.Equals(key, DatabricksAppResourceKinds.Postgres, StringComparison.Ordinal))
                {
                    NormalizedAppResourceDto? normalized = TryMapKnownType(key, prop.Value, name, description, options);
                    if (normalized != null)
                    {
                        resources.Add(normalized);
                    }
                    else
                    {
                        warnings.Add(new AppSettingsWarningDto
                        {
                            Code = "resource_mapping_failed",
                            Message = $"Failed to map known resource type '{key}' at resources[{index}].",
                            ResourceIndex = index,
                            UnknownTypeKey = key
                        });
                    }
                }
                else
                {
                    warnings.Add(new AppSettingsWarningDto
                    {
                        Code = "unknown_resource_type",
                        Message = $"Unknown resource type key '{key}' at resources[{index}].",
                        ResourceIndex = index,
                        UnknownTypeKey = key
                    });
                }
            }

            index++;
        }

        return new AppSettingsDetailsDto
        {
            ComputeSize = computeSize,
            Resources = resources,
            Warnings = warnings
        };
    }

    private static string ReadStringProperty(JsonElement item, string propertyName)
    {
        if (!item.TryGetProperty(propertyName, out JsonElement el))
        {
            return string.Empty;
        }

        return el.GetString() ?? string.Empty;
    }

    private static NormalizedAppResourceDto? TryMapKnownType(
        string key,
        JsonElement value,
        string name,
        string description,
        JsonSerializerOptions options)
    {
        try
        {
            NormalizedAppResourceDto dto = new NormalizedAppResourceDto
            {
                Kind = key,
                Name = name,
                Description = description
            };

            switch (key)
            {
                case DatabricksAppResourceKinds.SqlWarehouse:
                    dto.SqlWarehouse = JsonSerializer.Deserialize<SqlWarehouseResource>(value.GetRawText(), options);
                    return dto;
                case DatabricksAppResourceKinds.Job:
                    dto.Job = JsonSerializer.Deserialize<JobResource>(value.GetRawText(), options);
                    return dto;
                case DatabricksAppResourceKinds.Database:
                    dto.Database = JsonSerializer.Deserialize<DatabaseResource>(value.GetRawText(), options);
                    return dto;
                case DatabricksAppResourceKinds.Postgres:
                    if (value.TryGetProperty("branch", out _))
                    {
                        PostgresAppResource? pg = JsonSerializer.Deserialize<PostgresAppResource>(value.GetRawText(), options);
                        if (pg == null)
                        {
                            return null;
                        }

                        string instanceForUi = string.Empty;
                        if (LakebaseAutoscalingPostgresWireHelper.TryParseProjectAndBranchFromBranchResource(
                            pg.Branch,
                            out string pid,
                            out string bid))
                        {
                            instanceForUi = $"{pid}/{bid}";
                        }

                        dto.Database = new DatabaseResource
                        {
                            DatabaseName = LakebaseAutoscalingPostgresWireHelper.NormalizeDatabaseWireToShortName(pg.Database),
                            DatabaseDisplayName = string.Empty,
                            InstanceName = instanceForUi,
                            Permission = pg.Permission ?? string.Empty
                        };
                        dto.Kind = DatabricksAppResourceKinds.AutoscalingDatabase;
                        return dto;
                    }

                    dto.Database = JsonSerializer.Deserialize<DatabaseResource>(value.GetRawText(), options);
                    dto.Kind = DatabricksAppResourceKinds.Database;
                    return dto;
                case DatabricksAppResourceKinds.AutoscalingDatabase:
                    dto.Database = JsonSerializer.Deserialize<DatabaseResource>(value.GetRawText(), options);
                    dto.Kind = DatabricksAppResourceKinds.AutoscalingDatabase;
                    return dto;
                case DatabricksAppResourceKinds.Secret:
                    dto.Secret = JsonSerializer.Deserialize<SecretResource>(value.GetRawText(), options);
                    return dto;
                case DatabricksAppResourceKinds.Experiment:
                    dto.Experiment = JsonSerializer.Deserialize<ExperimentResource>(value.GetRawText(), options);
                    return dto;
                case DatabricksAppResourceKinds.GenieSpace:
                    dto.GenieSpace = JsonSerializer.Deserialize<GenieSpaceResource>(value.GetRawText(), options);
                    return dto;
                case DatabricksAppResourceKinds.ServingEndpoint:
                    dto.ServingEndpoint = JsonSerializer.Deserialize<ServingEndpointResource>(value.GetRawText(), options);
                    return dto;
                case DatabricksAppResourceKinds.UcSecurable:
                    dto.UcSecurable = JsonSerializer.Deserialize<UcSecurableResource>(value.GetRawText(), options);
                    return dto;
                default:
                    return null;
            }
        }
        catch (JsonException)
        {
            return null;
        }
    }

}
