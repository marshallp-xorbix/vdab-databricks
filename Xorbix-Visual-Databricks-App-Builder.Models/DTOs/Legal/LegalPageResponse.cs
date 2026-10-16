namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Legal;

/// <summary>
/// Sanitized legal page content fetched from the WordPress marketing site.
/// </summary>
public sealed class LegalPageResponse
{
    /// <summary>
    /// WordPress page slug (e.g. privacy-policy).
    /// </summary>
    public required string Slug { get; init; }

    /// <summary>
    /// Sanitized HTML body suitable for trusted rendering in the SPA.
    /// </summary>
    public required string HtmlContent { get; init; }
}
