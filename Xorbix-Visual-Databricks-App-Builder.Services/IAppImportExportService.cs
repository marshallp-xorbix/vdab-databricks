using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Exports and imports app definitions (including their components) in a portable,
/// identity-free form. Intended for global-administrator tooling.
/// </summary>
public interface IAppImportExportService
{
    /// <summary>
    /// Exports every app belonging to the given tenant, including each app's components.
    /// </summary>
    /// <param name="tenantId">The tenant whose apps to export.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A Result containing the export bundle.</returns>
    Task<Result<ExportBundleDto>> ExportAppsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Exports a single app (including its components), scoped to the given tenant.
    /// </summary>
    /// <param name="appId">The app to export.</param>
    /// <param name="tenantId">The tenant the app must belong to.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A Result containing the export bundle.</returns>
    Task<Result<ExportBundleDto>> ExportAppAsync(int appId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Imports a single app into the given tenant, assigning the supplied owner and
    /// Databricks connection. The app name is auto-renamed if it collides with an
    /// existing app in the tenant.
    /// </summary>
    /// <param name="request">The resolved import element.</param>
    /// <param name="tenantId">The tenant to import into.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A Result describing the imported element.</returns>
    Task<Result<ImportElementResultDto>> ImportAppAsync(ImportAppRequest request, Guid tenantId, CancellationToken cancellationToken = default);
}
