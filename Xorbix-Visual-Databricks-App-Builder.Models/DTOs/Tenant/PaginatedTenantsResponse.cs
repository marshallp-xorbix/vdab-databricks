namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Paginated response for tenant listings.
/// </summary>
public class PaginatedTenantsResponse
{
    /// <summary>
    /// The tenants in the current page.
    /// </summary>
    public required IEnumerable<TenantDto> Tenants { get; init; }

    /// <summary>
    /// Total number of tenants matching the query.
    /// </summary>
    public required int TotalCount { get; init; }

    /// <summary>
    /// Number of records skipped.
    /// </summary>
    public required int Skip { get; init; }

    /// <summary>
    /// Number of records returned per page.
    /// </summary>
    public required int Take { get; init; }
}
