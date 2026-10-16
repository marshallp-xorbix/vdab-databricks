namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Paginated Stripe event log response.
/// </summary>
public class PaginatedStripeEventLogsResponse
{
    /// <summary>
    /// The logs in the requested page.
    /// </summary>
    public required IList<StripeEventLogDto> Logs { get; init; }

    /// <summary>
    /// Total number of Stripe event logs.
    /// </summary>
    public required int TotalCount { get; init; }

    /// <summary>
    /// The resolved 1-based page number.
    /// </summary>
    public required int PageNumber { get; init; }

    /// <summary>
    /// The resolved page size.
    /// </summary>
    public required int PageSize { get; init; }
}