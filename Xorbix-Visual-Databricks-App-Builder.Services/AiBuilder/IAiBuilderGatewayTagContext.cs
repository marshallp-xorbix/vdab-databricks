using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Holds optional AI Builder gateway tag metadata for the current HTTP request scope.
/// </summary>
public interface IAiBuilderGatewayTagContext
{
    /// <summary>
    /// Sets gateway tags for the current AI Builder session.
    /// </summary>
    /// <param name="tags">Tag metadata to stamp on outbound AI Gateway requests.</param>
    void Set(AiBuilderGatewayTags tags);

    /// <summary>
    /// Clears any gateway tags set for the current scope.
    /// </summary>
    void Clear();

    /// <summary>
    /// Returns gateway tags when an AI Builder session is active.
    /// </summary>
    /// <param name="tags">The active tags, if any.</param>
    /// <returns><see langword="true"/> when tags are set; otherwise <see langword="false"/>.</returns>
    bool TryGet(out AiBuilderGatewayTags? tags);
}
