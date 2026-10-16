using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class TenantResourceGuard : ITenantResourceGuard
{
    /// <inheritdoc/>
    public Result EnsureAppInTenant(AppDto? app, Guid tenantId)
    {
        if (app is null)
        {
            return Result.Fail(new NotFoundError("App not found."));
        }

        if (!app.TenantId.HasValue || app.TenantId.Value != tenantId)
        {
            return Result.Fail(new ForbiddenError("App is not available for this tenant."));
        }

        return Result.Ok();
    }

    /// <inheritdoc/>
    public Result EnsureAppInTenant(App? app, Guid tenantId)
    {
        if (app is null)
        {
            return Result.Fail(new NotFoundError("App not found."));
        }

        if (app.TenantId != tenantId)
        {
            return Result.Fail(new ForbiddenError("App is not available for this tenant."));
        }

        return Result.Ok();
    }

    /// <inheritdoc/>
    public Result EnsureConnectionInTenant(DatabricksConnection? connection, Guid tenantId)
    {
        if (connection is null)
        {
            return Result.Fail(new NotFoundError("Databricks connection not found."));
        }

        if (connection.TenantId != tenantId)
        {
            return Result.Fail(new ForbiddenError("Databricks connection is not available for this tenant."));
        }

        return Result.Ok();
    }

    /// <inheritdoc/>
    public Result EnsureTenantAiModelInTenant(TenantAiModel? model, Guid tenantId)
    {
        if (model is null)
        {
            return Result.Fail(new NotFoundError("Tenant AI model not found."));
        }

        if (model.TenantId != tenantId)
        {
            return Result.Fail(new ForbiddenError("Tenant AI model is not available for this tenant."));
        }

        return Result.Ok();
    }

    /// <inheritdoc/>
    public Result EnsureCanDeleteApp(App? app, Guid tenantId, Guid userId, bool isTenantAdmin)
    {
        Result tenantResult = EnsureAppInTenant(app, tenantId);
        if (tenantResult.IsFailed)
        {
            return tenantResult;
        }

        return EnsureOwnerOrTenantAdmin(app!.OwnerId, userId, isTenantAdmin, "App");
    }

    /// <inheritdoc/>
    public Result EnsureCanDeleteConnection(DatabricksConnection? connection, Guid tenantId, Guid userId, bool isTenantAdmin)
    {
        Result tenantResult = EnsureConnectionInTenant(connection, tenantId);
        if (tenantResult.IsFailed)
        {
            return tenantResult;
        }

        return EnsureOwnerOrTenantAdmin(connection!.OwnerId, userId, isTenantAdmin, "Databricks connection");
    }

    private static Result EnsureOwnerOrTenantAdmin(Guid ownerId, Guid userId, bool isTenantAdmin, string resourceName)
    {
        if (isTenantAdmin || ownerId == userId)
        {
            return Result.Ok();
        }

        return Result.Fail(
            new ForbiddenError($"{resourceName} can only be deleted by its owner or a tenant administrator."));
    }
}
