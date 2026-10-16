namespace Xorbix_Visual_Databricks_App_Builder.Models;

public sealed class PlatformStatusResponse
{
    public string PlatformStatus { get; init; } = string.Empty;

    public bool PaymentsAvailable { get; init; }

    public bool AiAvailable { get; init; }
}