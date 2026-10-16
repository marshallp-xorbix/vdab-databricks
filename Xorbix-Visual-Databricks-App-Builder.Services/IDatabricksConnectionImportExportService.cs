using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Exports and imports Databricks connection definitions in a portable, identity-free
/// form (client secrets are never exported). Intended for global-administrator tooling.
/// </summary>
public interface IDatabricksConnectionImportExportService
{
    /// <summary>
    /// Exports every Databricks connection belonging to the given tenant.
    /// </summary>
    /// <param name="tenantId">The tenant whose connections to export.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A Result containing the export bundle.</returns>
    Task<Result<ExportBundleDto>> ExportConnectionsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Exports a single Databricks connection, scoped to the given tenant.
    /// </summary>
    /// <param name="connectionId">The connection to export.</param>
    /// <param name="tenantId">The tenant the connection must belong to.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A Result containing the export bundle.</returns>
    Task<Result<ExportBundleDto>> ExportConnectionAsync(int connectionId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Imports a single Databricks connection into the given tenant, assigning the
    /// supplied owner. Connections whose workspace URL already exists in the tenant are
    /// rejected with a conflict so the caller can skip them; display names are
    /// auto-renamed if they collide.
    /// </summary>
    /// <param name="request">The resolved import element.</param>
    /// <param name="tenantId">The tenant to import into.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A Result describing the imported element.</returns>
    Task<Result<ImportElementResultDto>> ImportConnectionAsync(ImportConnectionRequest request, Guid tenantId, CancellationToken cancellationToken = default);
}
