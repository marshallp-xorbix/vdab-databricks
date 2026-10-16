using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for Databricks deployment operations such as app upload and deployment.
/// </summary>
public interface IDeployService
{
    /// <summary>
    /// Uploads a Streamlit app payload (code, config, env) to a Databricks workspace.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="tenantId">The tenant ID to authorize app/theme lookups against.</param>
    /// <param name="request">Upload configuration and component payload.</param>
    /// <returns>A result containing upload details.</returns>
    Task<Result<StreamlitUploadResult>> UploadStreamlitAppAsync(Guid userId, Guid tenantId, StreamlitUploadRequest request);

    /// <summary>
    /// Deploys an app from an existing workspace folder.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="request">Deployment configuration.</param>
    /// <returns>A result containing deployment details.</returns>
    Task<Result<DeployAppFromFolderResult>> DeployAppFromFolderAsync(Guid userId, DeployAppFromFolderRequest request);

    /// <summary>
    /// Performs a simplified upload + deploy flow for a user.
    /// </summary>
    /// <param name="request">Simplified deployment request.</param>
    /// <param name="userId">User identifier used to resolve connections.</param>
    /// <returns>A result containing deployment details.</returns>
    Task<Result<DeployAppFromFolderResult>> SimpleDeployAsync(SimpleDeployRequest request, Guid userId, Guid tenantId);

    /// <summary>
    /// Generates Streamlit code preview for the current payload without deploying.
    /// </summary>
    /// <param name="request">Preview generation request payload.</param>
    /// <param name="userId">User identifier for request context.</param>
    /// <returns>A result containing generated code and warnings.</returns>
    Task<Result<GeneratedCodePreviewResult>> PreviewGeneratedCodeAsync(GeneratedCodePreviewRequest request, Guid userId, Guid tenantId);
}
