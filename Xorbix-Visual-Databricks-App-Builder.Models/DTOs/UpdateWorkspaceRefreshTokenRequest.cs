namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs
{
    /// <summary>
    /// Request model for updating a user's Databricks refresh token.
    /// </summary>
    public class UpdateWorkspaceRefreshTokenRequest
    {
        /// <summary>
        /// The ID of the workspace connection.
        /// </summary>
        public int WorkspaceConnectionId { get; set; }

        /// <summary>
        /// The refresh token to store.
        /// </summary>
        public string RefreshToken { get; set; } = string.Empty;

        /// <summary>
        /// Optional expiration date/time for the refresh token.
        /// </summary>
        public DateTime? ExpiresAt { get; set; }
    }
}
