using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Services;

/// <inheritdoc/>
public sealed class AiBuilderGatewayTagContext(IHttpContextAccessor httpContextAccessor) : IAiBuilderGatewayTagContext
{
    /// <inheritdoc/>
    public void Set(AiBuilderGatewayTags tags)
    {
        HttpContext? context = httpContextAccessor.HttpContext;
        if (context is null)
            return;

        context.Items[AiBuilderGatewayTagContextKeys.HttpContextItemKey] = tags;
    }

    /// <inheritdoc/>
    public void Clear()
    {
        httpContextAccessor.HttpContext?.Items.Remove(AiBuilderGatewayTagContextKeys.HttpContextItemKey);
    }

    /// <inheritdoc/>
    public bool TryGet(out AiBuilderGatewayTags? tags)
    {
        if (httpContextAccessor.HttpContext?.Items[AiBuilderGatewayTagContextKeys.HttpContextItemKey] is AiBuilderGatewayTags stored)
        {
            tags = stored;
            return true;
        }

        tags = null;
        return false;
    }
}
