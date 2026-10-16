using Microsoft.SemanticKernel;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Builds Semantic Kernel instances for AI Builder requests.
/// </summary>
public interface IAiBuilderKernelFactory
{
    /// <summary>
    /// Creates a kernel configured for the resolved Databricks AI Gateway model.
    /// </summary>
    Kernel CreateKernel(ResolvedAiModelConfiguration configuration);
}
