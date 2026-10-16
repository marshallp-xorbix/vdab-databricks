using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Legal;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Fetches and sanitizes public legal page HTML from the WordPress marketing site.
/// </summary>
public interface ILegalContentService
{
    /// <summary>
    /// Returns sanitized HTML for an allowed legal page slug.
    /// </summary>
    /// <param name="slug">WordPress page slug (must be a configured legal slug).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Sanitized page content, or a typed failure.</returns>
    Task<Result<LegalPageResponse>> GetPageBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default);
}
