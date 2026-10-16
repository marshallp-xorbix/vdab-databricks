using System.Text.Json;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Shared JSON serializer options for AI Builder serialization.
/// </summary>
internal static class AiBuilderJsonOptions
{
    internal static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    internal static readonly JsonSerializerOptions Compact = new()
    {
        WriteIndented = false,
    };
}
