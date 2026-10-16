using System.Linq;
using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Validates normalized app resources and maps them to Databricks wire objects.
/// </summary>
public static class AppResourcesPayloadBuilder
{
    /// <summary>
    /// Validates resources (required fields, unique keys) and builds Databricks <c>resources</c> array entries.
    /// </summary>
    public static Result<List<DatabricksAppResource>> BuildAndValidate(IReadOnlyList<NormalizedAppResourceDto> resources)
    {
        List<ValidationError> errors = new();
        HashSet<string> seenNames = new(StringComparer.Ordinal);
        List<DatabricksAppResource> list = new(capacity: resources.Count);

        for (int i = 0; i < resources.Count; i++)
        {
            NormalizedAppResourceDto dto = resources[i];
            string prefix = $"resources[{i}]";

            if (string.IsNullOrWhiteSpace(dto.Kind))
            {
                errors.Add(new ValidationError($"{prefix}: Kind is required."));
                continue;
            }

            if (!DatabricksAppResourceKinds.KnownKinds.Contains(dto.Kind))
            {
                errors.Add(new ValidationError($"{prefix}: Unknown resource kind '{dto.Kind}'."));
                continue;
            }

            string nameKey = (dto.Name ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(nameKey))
            {
                errors.Add(new ValidationError($"{prefix}: Resource key (name) is required."));
                continue;
            }

            if (!seenNames.Add(nameKey))
            {
                errors.Add(new ValidationError($"Duplicate resource key '{nameKey}'. Keys must be unique."));
                continue;
            }

            Result<DatabricksAppResource> row = MapRow(dto, prefix);
            if (row.IsFailed)
            {
                errors.AddRange(row.Errors.OfType<ValidationError>());
                continue;
            }

            list.Add(row.Value);
        }

        if (errors.Count > 0)
        {
            return Result.Fail<List<DatabricksAppResource>>(errors);
        }

        return Result.Ok(list);
    }

    private static Result<DatabricksAppResource> MapRow(NormalizedAppResourceDto dto, string prefix)
    {
        DatabricksAppResource resource = new DatabricksAppResource
        {
            Name = (dto.Name ?? string.Empty).Trim(),
            Description = dto.Description?.Trim() ?? string.Empty
        };

        switch (dto.Kind)
        {
            case DatabricksAppResourceKinds.SqlWarehouse:
                if (dto.SqlWarehouse == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.SqlWarehouse} is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.SqlWarehouse.Id))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: SQL warehouse id is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.SqlWarehouse.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: SQL warehouse permission is required."));
                }

                resource.SqlWarehouse = new SqlWarehouseResource
                {
                    Id = dto.SqlWarehouse.Id.Trim(),
                    Permission = dto.SqlWarehouse.Permission.Trim()
                };
                return Result.Ok(resource);

            case DatabricksAppResourceKinds.Job:
                if (dto.Job == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.Job} is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Job.Id))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Job id is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Job.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Job permission is required."));
                }

                resource.Job = new JobResource
                {
                    Id = dto.Job.Id.Trim(),
                    Permission = dto.Job.Permission.Trim()
                };
                return Result.Ok(resource);

            case DatabricksAppResourceKinds.Database:
                if (dto.Database == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: database is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Database.DatabaseName))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: database_name is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Database.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Database permission is required."));
                }

                resource.Database = new DatabaseResource
                {
                    DatabaseName = dto.Database.DatabaseName.Trim(),
                    InstanceName = dto.Database.InstanceName?.Trim() ?? string.Empty,
                    Permission = dto.Database.Permission.Trim()
                };
                return Result.Ok(resource);

            case DatabricksAppResourceKinds.AutoscalingDatabase:
                if (dto.Database == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: database is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Database.DatabaseName))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: database_name is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Database.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Database permission is required."));
                }

                string autoscalingInstance = dto.Database.InstanceName?.Trim() ?? string.Empty;
                if (!LakebaseAutoscalingPostgresWireHelper.TryParseProjectAndBranchFromInstanceName(
                    autoscalingInstance,
                    out string projectId,
                    out string branchUid))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError(
                        $"{prefix}: instance_name must be project_id/branch_uid for autoscaling Lakebase (postgres) resources."));
                }

                // Apps API: database must be projects/.../branches/.../databases/{database_id}
                // (never .../catalogs/...). Accept full wire strings or short ids from the UI.
                string databaseIdSegment = LakebaseAutoscalingPostgresWireHelper.NormalizeDatabaseIdSegment(dto.Database.DatabaseName);
                string databaseWire = LakebaseAutoscalingPostgresWireHelper.BuildDatabaseResource(
                    projectId,
                    branchUid,
                    databaseIdSegment);
                resource.Postgres = new PostgresAppResource
                {
                    Branch = LakebaseAutoscalingPostgresWireHelper.BuildBranchResource(projectId, branchUid),
                    Database = databaseWire,
                    Permission = dto.Database.Permission.Trim()
                };
                return Result.Ok(resource);

            case DatabricksAppResourceKinds.Secret:
                if (dto.Secret == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.Secret} is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Secret.Key))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: secret key is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Secret.Scope))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: secret scope is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Secret.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Secret permission is required."));
                }

                resource.Secret = new SecretResource
                {
                    Key = dto.Secret.Key.Trim(),
                    Scope = dto.Secret.Scope.Trim(),
                    Permission = dto.Secret.Permission.Trim()
                };
                return Result.Ok(resource);

            case DatabricksAppResourceKinds.Experiment:
                if (dto.Experiment == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.Experiment} is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Experiment.ExperimentId))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: experiment_id is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.Experiment.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Experiment permission is required."));
                }

                resource.Experiment = new ExperimentResource
                {
                    ExperimentId = dto.Experiment.ExperimentId.Trim(),
                    Permission = dto.Experiment.Permission.Trim()
                };
                return Result.Ok(resource);

            case DatabricksAppResourceKinds.GenieSpace:
                if (dto.GenieSpace == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.GenieSpace} is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.GenieSpace.Name))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.GenieSpace} name is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.GenieSpace.SpaceId))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: space_id is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.GenieSpace.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Genie space permission is required."));
                }

                resource.GenieSpace = new GenieSpaceResource
                {
                    Name = dto.GenieSpace.Name.Trim(),
                    SpaceId = dto.GenieSpace.SpaceId.Trim(),
                    Permission = dto.GenieSpace.Permission.Trim()
                };
                return Result.Ok(resource);

            case DatabricksAppResourceKinds.ServingEndpoint:
                if (dto.ServingEndpoint == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.ServingEndpoint} is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.ServingEndpoint.Name))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.ServingEndpoint} name is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.ServingEndpoint.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Serving endpoint permission is required."));
                }

                resource.ServingEndpoint = new ServingEndpointResource
                {
                    Name = dto.ServingEndpoint.Name.Trim(),
                    Permission = dto.ServingEndpoint.Permission.Trim()
                };
                return Result.Ok(resource);

            case DatabricksAppResourceKinds.UcSecurable:
                if (dto.UcSecurable == null)
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: {DatabricksAppResourceKinds.UcSecurable} is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.UcSecurable.SecurableFullName))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: securable_full_name is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.UcSecurable.SecurableType))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: securable_type is required."));
                }

                if (string.IsNullOrWhiteSpace(dto.UcSecurable.Permission))
                {
                    return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Unity Catalog securable permission is required."));
                }

                resource.UcSecurable = new UcSecurableResource
                {
                    SecurableFullName = dto.UcSecurable.SecurableFullName.Trim(),
                    SecurableType = dto.UcSecurable.SecurableType.Trim(),
                    Permission = dto.UcSecurable.Permission.Trim()
                };
                return Result.Ok(resource);

            default:
                return Result.Fail<DatabricksAppResource>(new ValidationError($"{prefix}: Unsupported kind '{dto.Kind}'."));
        }
    }

}
