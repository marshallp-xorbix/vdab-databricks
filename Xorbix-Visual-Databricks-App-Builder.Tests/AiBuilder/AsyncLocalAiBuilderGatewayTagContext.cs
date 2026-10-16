using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

/// <summary>
/// Test-only gateway tag store. Production uses <c>Server.Services.AiBuilderGatewayTagContext</c>
/// backed by <see cref="Microsoft.AspNetCore.Http.HttpContext.Items"/> so tags survive Semantic Kernel HTTP calls.
/// </summary>
internal sealed class AsyncLocalAiBuilderGatewayTagContext : IAiBuilderGatewayTagContext
{
    private static readonly AsyncLocal<AiBuilderGatewayTags?> Tags = new();

    /// <inheritdoc/>
    public void Set(AiBuilderGatewayTags tags) => Tags.Value = tags;

    /// <inheritdoc/>
    public void Clear() => Tags.Value = null;

    /// <inheritdoc/>
    public bool TryGet(out AiBuilderGatewayTags? tags)
    {
        tags = Tags.Value;
        return tags is not null;
    }
}
