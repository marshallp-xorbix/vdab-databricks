using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class DatabricksLakebaseDatabaseServiceAutoscalingTests
{
    private const string WorkspaceUrl = "https://dbc.test.cloud.databricks.com";

    private static JsonElement ParseElement(string json)
    {
        using JsonDocument doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_MapsProjectsBranchesEndpointsAndPaginates()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver
            .Setup(x => x.ResolveWorkspaceUrlAsync(11))
            .ReturnsAsync(Result.Ok(WorkspaceUrl));

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    { "name": "projects/vdab-autoscale-lakebase", "display_name": "VDAB Autoscale Lakebase" }
                  ],
                  "next_page_token": "next-projects"
                }
                """),
            ["/api/2.0/postgres/projects?page_size=100&page_token=next-projects"] = ParseElement(
                """
                {
                  "projects": [
                    { "name": "projects/analytics-lakebase", "display_name": "Analytics Lakebase" }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    { "name": "projects/vdab-autoscale-lakebase/branches/main", "default": true }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """
                {
                  "endpoints": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/endpoints/default-rw",
                      "spec": {
                        "endpoint_type": "ENDPOINT_TYPE_READ_WRITE",
                        "autoscaling_limit_min_cu": 0.5,
                        "autoscaling_limit_max_cu": 4.0,
                        "suspend_timeout_duration": "3600s"
                      },
                      "status": {
                        "state": "STATE_READY"
                      }
                    }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/analytics-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    { "name": "projects/analytics-lakebase/branches/main", "default": true }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/analytics-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """
                {
                  "endpoints": [
                    {
                      "name": "projects/analytics-lakebase/branches/main/endpoints/default-rw",
                      "spec": {
                        "endpoint_type": "ENDPOINT_TYPE_READ_WRITE",
                        "autoscaling_limit_min_cu": 1.0,
                        "autoscaling_limit_max_cu": 8.0
                      }
                    }
                  ]
                }
                """),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 11);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Projects.Count);
        Assert.Equal("Analytics Lakebase", result.Value.Projects[0].DisplayName);
        Assert.Equal("VDAB Autoscale Lakebase", result.Value.Projects[1].DisplayName);

        LakebaseAutoscalingEndpointOption endpoint =
            result.Value.Projects[1].Branches[0].Endpoints[0];
        Assert.Equal(0.5d, endpoint.AutoscalingLimitMinCu);
        Assert.Equal(4.0d, endpoint.AutoscalingLimitMaxCu);
        Assert.Equal("STATE_READY", endpoint.EffectiveStatus);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_ReturnsEmptyProjects_WhenNoProjectsFound()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(7)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                "/api/2.0/postgres/projects?page_size=100",
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok(ParseElement("""{ "projects": [] }""")));

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 7);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Projects);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_FailsForInvalidWorkspaceConnectionId()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver
            .Setup(x => x.ResolveWorkspaceUrlAsync(0))
            .ReturnsAsync(Result.Fail<string>("Workspace connection ID is required"));

        Mock<IDatabricksApiService> databricksApi = new();
        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 0);

        Assert.True(result.IsFailed);
        Assert.Contains("Workspace connection ID is required", result.Errors[0].Message, StringComparison.Ordinal);
        databricksApi.Verify(
            x => x.GetAsync<JsonElement>(
                It.IsAny<Guid>(),
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()),
            Times.Never);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_FailsWhenWorkspaceConnectionMissing()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver
            .Setup(x => x.ResolveWorkspaceUrlAsync(42))
            .ReturnsAsync(Result.Fail<string>("Workspace connection not found"));

        Mock<IDatabricksApiService> databricksApi = new();
        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 42);

        Assert.True(result.IsFailed);
        Assert.Contains("Workspace connection not found", result.Errors[0].Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_PropagatesUpstreamFailure()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(8)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                "/api/2.0/postgres/projects?page_size=100",
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync(Result.Fail<JsonElement>(new UpstreamDependencyError("Databricks upstream failed")));

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 8);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<UpstreamDependencyError>());
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_SkipsMalformedRows()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(13)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    { "display_name": "Missing Name Project" },
                    { "name": "projects/vdab-autoscale-lakebase", "display_name": "VDAB Autoscale Lakebase" }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    { "default": true },
                    { "name": "projects/vdab-autoscale-lakebase/branches/main", "default": true }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """
                {
                  "endpoints": [
                    { "spec": { "endpoint_type": "ENDPOINT_TYPE_READ_ONLY" } },
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/endpoints/read-only-1",
                      "spec": { "endpoint_type": "ENDPOINT_TYPE_READ_ONLY", "autoscaling_limit_min_cu": 0.5, "autoscaling_limit_max_cu": 2.0 }
                    }
                  ]
                }
                """),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 13);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Projects);
        Assert.Single(result.Value.Projects[0].Branches);
        Assert.Single(result.Value.Projects[0].Branches[0].Endpoints);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_PrefersNameStyleLabelsOverUuidFields()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(21)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    {
                      "name": "projects/vdab-autoscale-lakebase",
                      "id": "781a7ec7-2422-4824-80bf-e3ea91f13eab",
                      "project_name": "vdab-autoscale-lakebase"
                    }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main",
                      "id": "2d8f4de9-0106-41c6-a7fd-0099f68e7132",
                      "display_name": "main",
                      "default": true
                    }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """
                {
                  "endpoints": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/endpoints/ep-aged-rice-d20d8hbt",
                      "id": "dcf28f34-b77f-4cc2-a0aa-a0328866e493",
                      "display_name": "ep-aged-rice-d20d8hbt",
                      "spec": {
                        "endpoint_type": "ENDPOINT_TYPE_READ_WRITE"
                      }
                    }
                  ]
                }
                """),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 21);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Projects);
        Assert.Equal("vdab-autoscale-lakebase", result.Value.Projects[0].DisplayName);
        Assert.Equal("main", result.Value.Projects[0].Branches[0].BranchName);
        Assert.Equal("ep-aged-rice-d20d8hbt", result.Value.Projects[0].Branches[0].Endpoints[0].EndpointName);
    }

    /// <summary>
    /// Matches Lakebase UI project rows where <c>name</c> is <c>projects/{uuid}</c> but the
    /// human-readable name (Name column) is only present under <c>spec.project_name</c>.
    /// </summary>
    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_UsesSpecProjectNameWhenResourceNameIsProjectsUuid()
    {
        const string projectUuid = "781a7ec7-2422-4824-80bf-e3ea91f13eab";
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(22)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    {
                      "name": "projects/781a7ec7-2422-4824-80bf-e3ea91f13eab",
                      "id": "781a7ec7-2422-4824-80bf-e3ea91f13eab",
                      "spec": {
                        "project_name": "vdab-autoscale-lakebase"
                      }
                    }
                  ]
                }
                """),
            [$"/api/2.0/postgres/projects/{projectUuid}/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    {
                      "name": "projects/781a7ec7-2422-4824-80bf-e3ea91f13eab/branches/main",
                      "default": true
                    }
                  ]
                }
                """),
            [$"/api/2.0/postgres/projects/{projectUuid}/branches/main/endpoints?page_size=100"] = ParseElement(
                """
                {
                  "endpoints": [
                    {
                      "name": "projects/781a7ec7-2422-4824-80bf-e3ea91f13eab/branches/main/endpoints/default-rw",
                      "spec": {
                        "endpoint_type": "ENDPOINT_TYPE_READ_WRITE"
                      }
                    }
                  ]
                }
                """),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 22);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Projects);
        Assert.Equal("vdab-autoscale-lakebase", result.Value.Projects[0].DisplayName);
        Assert.Equal(projectUuid, result.Value.Projects[0].ProjectId);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_DatabaseResource_PrefersLogicalNameOverEarlyDbWireField()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(91)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    { "name": "projects/vdab-autoscale-lakebase", "display_name": "VDAB Autoscale Lakebase" }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    { "name": "projects/vdab-autoscale-lakebase/branches/main", "default": true }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/databases?page_size=100"] = ParseElement(
                """
                {
                  "databases": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/databases/db-compat-85288",
                      "spec": {
                        "name": "db-compat-85288",
                        "database_name": "databricks_postgres"
                      }
                    }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """{ "endpoints": [] }"""),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 91);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Projects);
        LakebaseAutoscalingEndpointOption db =
            Assert.Single(result.Value.Projects[0].Branches[0].Endpoints);
        Assert.Equal("db-compat-85288", db.EndpointId);
        Assert.Equal("db-compat-85288", db.AppsDatabaseResourceId);
        Assert.Equal("databricks_postgres", db.PostgresDatabaseName);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_DatabaseResource_KeepsWireOnlyNameWhenListOmitsLogicalFields()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(92)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    { "name": "projects/vdab-autoscale-lakebase", "display_name": "VDAB Autoscale Lakebase" }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    { "name": "projects/vdab-autoscale-lakebase/branches/main", "default": true }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/databases?page_size=100"] = ParseElement(
                """
                {
                  "databases": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/databases/db-compat-999",
                      "spec": {
                        "name": "db-compat-999",
                        "display_name": "db-compat-999"
                      }
                    }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """{ "endpoints": [] }"""),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 92);

        Assert.True(result.IsSuccess);
        LakebaseAutoscalingEndpointOption db =
            Assert.Single(result.Value.Projects[0].Branches[0].Endpoints);
        Assert.Equal("db-compat-999", db.EndpointId);
        Assert.Equal("db-compat-999", db.PostgresDatabaseName);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_DatabaseResource_UsesNestedMetadataDatabaseName()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(93)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    { "name": "projects/vdab-autoscale-lakebase", "display_name": "VDAB Autoscale Lakebase" }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    { "name": "projects/vdab-autoscale-lakebase/branches/main", "default": true }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/databases?page_size=100"] = ParseElement(
                """
                {
                  "databases": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/databases/db-abc",
                      "spec": {
                        "metadata": { "database_name": "databricks_postgres" }
                      }
                    }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """{ "endpoints": [] }"""),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 93);

        Assert.True(result.IsSuccess);
        LakebaseAutoscalingEndpointOption db =
            Assert.Single(result.Value.Projects[0].Branches[0].Endpoints);
        Assert.Equal("db-abc", db.EndpointId);
        Assert.Equal("databricks_postgres", db.PostgresDatabaseName);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_MergesEndpointLogicalNameOntoDatabaseResourceRow()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(94)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    { "name": "projects/vdab-autoscale-lakebase", "display_name": "VDAB Autoscale Lakebase" }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    { "name": "projects/vdab-autoscale-lakebase/branches/main", "default": true }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/databases?page_size=100"] = ParseElement(
                """
                {
                  "databases": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/databases/db-compat-merge",
                      "spec": { "name": "db-compat-merge" }
                    }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """
                {
                  "endpoints": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/endpoints/ep-merge-rw",
                      "spec": {
                        "endpoint_type": "ENDPOINT_TYPE_READ_WRITE",
                        "database": "projects/vdab-autoscale-lakebase/branches/main/databases/db-compat-merge",
                        "database_name": "databricks_postgres"
                      }
                    }
                  ]
                }
                """),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 94);

        Assert.True(result.IsSuccess);
        LakebaseAutoscalingEndpointOption dbRow =
            Assert.Single(result.Value.Projects[0].Branches[0].Endpoints);
        Assert.Equal("DATABASE_RESOURCE", dbRow.EndpointType);
        Assert.Equal("db-compat-merge", dbRow.EndpointId);
        Assert.Equal("databricks_postgres", dbRow.PostgresDatabaseName);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelectorAsync_EnrichesLogicalNameFromDatabaseDetailGetWhenListIsThin()
    {
        Guid userId = Guid.NewGuid();
        Mock<IDatabricksWorkspaceConnectionResolver> resolver = new();
        resolver.Setup(x => x.ResolveWorkspaceUrlAsync(95)).ReturnsAsync(Result.Ok(WorkspaceUrl));

        const string listUrl =
            "/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/databases?page_size=100";
        const string detailUrl =
            "/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/databases/db-thin-detail";

        Dictionary<string, JsonElement> responses = new(StringComparer.Ordinal)
        {
            ["/api/2.0/postgres/projects?page_size=100"] = ParseElement(
                """
                {
                  "projects": [
                    { "name": "projects/vdab-autoscale-lakebase", "display_name": "VDAB Autoscale Lakebase" }
                  ]
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches?page_size=100"] = ParseElement(
                """
                {
                  "branches": [
                    { "name": "projects/vdab-autoscale-lakebase/branches/main", "default": true }
                  ]
                }
                """),
            [listUrl] = ParseElement(
                """
                {
                  "databases": [
                    {
                      "name": "projects/vdab-autoscale-lakebase/branches/main/databases/db-thin-detail",
                      "spec": { "name": "db-thin-detail" }
                    }
                  ]
                }
                """),
            [detailUrl] = ParseElement(
                """
                {
                  "name": "projects/vdab-autoscale-lakebase/branches/main/databases/db-thin-detail",
                  "spec": {
                    "name": "db-thin-detail",
                    "database_name": "databricks_postgres"
                  }
                }
                """),
            ["/api/2.0/postgres/projects/vdab-autoscale-lakebase/branches/main/endpoints?page_size=100"] = ParseElement(
                """{ "endpoints": [] }"""),
        };

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                WorkspaceUrl,
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync((Guid _, int _, string _, string endpoint, JsonSerializerOptions? _) =>
            {
                return responses.TryGetValue(endpoint, out JsonElement response)
                    ? Result.Ok(response)
                    : Result.Fail<JsonElement>(new UpstreamDependencyError($"Unexpected endpoint: {endpoint}"));
            });

        DatabricksLakebaseDatabaseService sut = new(
            databricksApi.Object,
            resolver.Object,
            NullLogger<DatabricksLakebaseDatabaseService>.Instance);

        Result<LakebaseAutoscalingSelectorResponse> result =
            await sut.GetLakebaseAutoscalingSelectorAsync(userId, 95);

        Assert.True(result.IsSuccess);
        LakebaseAutoscalingEndpointOption db =
            Assert.Single(result.Value.Projects[0].Branches[0].Endpoints);
        Assert.Equal("db-thin-detail", db.EndpointId);
        Assert.Equal("databricks_postgres", db.PostgresDatabaseName);
    }
}
