using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

public interface IAiBuilderService
{
    /// <summary>
    /// Streams VDAB canvas component generation, yielding a progress event for each
    /// tool call the AI makes and a final result event when generation is complete.
    /// </summary>
    IAsyncEnumerable<AiBuilderStreamEvent> GenerateComponentsStreamAsync(AiBuilderRequest request, Guid userId, Guid tenantId, CancellationToken ct = default);
}
