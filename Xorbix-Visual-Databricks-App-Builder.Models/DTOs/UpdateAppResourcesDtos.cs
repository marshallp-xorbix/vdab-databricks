namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Request body for replacing an app's Databricks resources (full list).
/// </summary>
public class UpdateAppResourcesRequestDto
{
    /// <summary>
    /// Complete resource list to persist (replace-style).
    /// </summary>
    public List<NormalizedAppResourceDto> Resources { get; set; } = new();

    /// <summary>
    /// Value of <c>update_time</c> from the last successful GET app details (optimistic concurrency).
    /// </summary>
    public string ExpectedUpdateTime { get; set; } = string.Empty;
}

/// <summary>
/// Response after updating app resources — aligned with app details for client rehydration.
/// </summary>
public class UpdateAppResourcesResponseDto
{
    /// <summary>
    /// Databricks <c>update_time</c> after the update.
    /// </summary>
    public string UpdateTime { get; set; } = string.Empty;

    /// <summary>
    /// Normalized app settings from Databricks (source of truth).
    /// </summary>
    public AppSettingsDetailsDto AppSettings { get; set; } = new();
}
