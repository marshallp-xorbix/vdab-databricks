using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.TenantAiModel;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>Controller for tenant-scoped AI model configurations used by AI Builder.</summary>
[ApiController]
[Authorize(Policy = AuthPolicies.RequireTenantMembership)]
[Route("api/[controller]")]
public class TenantAiModelController(
    ITenantAiModelService tenantAiModelService,
    ILogger<TenantAiModelController> logger) : AuthenticatedControllerBase
{
    /// <summary>Lists tenant AI models for the active tenant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TenantAiModelDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<TenantAiModelDto>>> GetAll(CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        Result<IReadOnlyList<TenantAiModelDto>> result = await tenantAiModelService.GetByTenantAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>Gets a tenant AI model by id.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(TenantAiModelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TenantAiModelDto>> GetById(int id, CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        Result<TenantAiModelDto> result = await tenantAiModelService.GetByIdAsync(id, tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>Creates a tenant AI model after validating the serving endpoint.</summary>
    [HttpPost]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [ProducesResponseType(typeof(TenantAiModelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TenantAiModelDto>> Create(
        [FromBody] CreateTenantAiModelRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return BadRequest("Request cannot be null.");
        }

        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        logger.LogInformation("Creating tenant AI model for tenant {TenantId}", tenantId);
        Result<TenantAiModelDto> result = await tenantAiModelService.CreateAsync(request, tenantId, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>Updates a tenant AI model after validating the serving endpoint.</summary>
    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [ProducesResponseType(typeof(TenantAiModelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TenantAiModelDto>> Update(
        int id,
        [FromBody] UpdateTenantAiModelRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return BadRequest("Request cannot be null.");
        }

        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        logger.LogInformation("Updating tenant AI model {TenantAiModelId} for tenant {TenantId}", id, tenantId);
        Result<TenantAiModelDto> result = await tenantAiModelService.UpdateAsync(id, request, tenantId, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>Soft-deletes a tenant AI model.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        logger.LogInformation("Deleting tenant AI model {TenantAiModelId} for tenant {TenantId}", id, tenantId);
        Result result = await tenantAiModelService.DeleteAsync(id, tenantId, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }
}
