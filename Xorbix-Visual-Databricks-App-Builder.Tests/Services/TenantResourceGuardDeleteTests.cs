using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies <see cref="TenantResourceGuard"/> delete-authorization: a resource may be deleted only by
/// its owner or a tenant administrator, and only within the owning tenant.
/// </summary>
public class TenantResourceGuardDeleteTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid OwnerId = Guid.NewGuid();

    private static App BuildApp() => new()
    {
        PkId = 1,
        AppName = "App",
        TenantId = TenantId,
        OwnerId = OwnerId,
    };

    private static DatabricksConnection BuildConnection() => new()
    {
        PkId = 1,
        TenantId = TenantId,
        OwnerId = OwnerId,
        WorkspaceUrl = "https://dbc.test.cloud.databricks.com",
        WorkspaceDisplayName = "Test",
    };

    [Fact]
    public void EnsureCanDeleteApp_Owner_Succeeds()
    {
        Result result = new TenantResourceGuard().EnsureCanDeleteApp(BuildApp(), TenantId, OwnerId, isTenantAdmin: false);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public void EnsureCanDeleteApp_TenantAdminNonOwner_Succeeds()
    {
        Result result = new TenantResourceGuard().EnsureCanDeleteApp(BuildApp(), TenantId, Guid.NewGuid(), isTenantAdmin: true);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public void EnsureCanDeleteApp_NonOwnerDeveloper_ReturnsForbidden()
    {
        Result result = new TenantResourceGuard().EnsureCanDeleteApp(BuildApp(), TenantId, Guid.NewGuid(), isTenantAdmin: false);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }

    [Fact]
    public void EnsureCanDeleteApp_WrongTenant_ReturnsForbidden()
    {
        Result result = new TenantResourceGuard().EnsureCanDeleteApp(BuildApp(), Guid.NewGuid(), OwnerId, isTenantAdmin: true);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }

    [Fact]
    public void EnsureCanDeleteConnection_Owner_Succeeds()
    {
        Result result = new TenantResourceGuard().EnsureCanDeleteConnection(BuildConnection(), TenantId, OwnerId, isTenantAdmin: false);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public void EnsureCanDeleteConnection_TenantAdminNonOwner_Succeeds()
    {
        Result result = new TenantResourceGuard().EnsureCanDeleteConnection(BuildConnection(), TenantId, Guid.NewGuid(), isTenantAdmin: true);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public void EnsureCanDeleteConnection_NonOwnerDeveloper_ReturnsForbidden()
    {
        Result result = new TenantResourceGuard().EnsureCanDeleteConnection(BuildConnection(), TenantId, Guid.NewGuid(), isTenantAdmin: false);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }

    [Fact]
    public void EnsureTenantAiModelInTenant_WrongTenant_ReturnsForbidden()
    {
        TenantAiModel model = new()
        {
            TenantAiModelId = 1,
            TenantId = TenantId,
            DatabricksConnectionId = 1,
            DisplayName = "Model",
            EndpointName = "endpoint",
            AccessToken = "token",
            CreatedByUserId = OwnerId,
        };

        Result result = new TenantResourceGuard().EnsureTenantAiModelInTenant(model, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }
}
