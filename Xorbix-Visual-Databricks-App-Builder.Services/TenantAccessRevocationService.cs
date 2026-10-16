using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class TenantAccessRevocationService(
    ILogger<TenantAccessRevocationService> _logger,
    IRefreshTokenRepository _refreshTokenRepository,
    IDatabricksConnectionRepository _databricksConnectionRepository,
    IDatabricksUserTokenRepository _databricksUserTokenRepository) : ITenantAccessRevocationService
{
    /// <inheritdoc/>
    public async Task RevokeAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        // Do not rotate the account-wide security stamp — that would log the user out of every
        // tenant (invariant 6 / 9). Access tokens for this tenant die when their session's
        // refresh tokens are revoked (AccessTokenSessionValidator checks HasActiveSessionAsync).

        await TryStepAsync(
            () => _refreshTokenRepository.RevokeAllForUserAndTenantAsync(userId, tenantId, cancellationToken),
            "refresh tokens",
            userId,
            tenantId,
            cancellationToken);

        await TryStepAsync(
            async () =>
            {
                IEnumerable<DatabricksConnection> connections =
                    await _databricksConnectionRepository.GetByTenantIdAsync(tenantId, cancellationToken);
                foreach (DatabricksConnection connection in connections)
                {
                    await TryStepAsync(
                        () => _databricksUserTokenRepository.RevokeAsync(userId, connection.PkId, cancellationToken),
                        "databricks token",
                        userId,
                        tenantId,
                        cancellationToken);
                }
            },
            "databricks connections",
            userId,
            tenantId,
            cancellationToken);

        _logger.LogInformation(
            "Revoked tenant access for user {UserId} from tenant {TenantId}",
            userId,
            tenantId);
    }

    private async Task TryStepAsync(
        Func<Task> step,
        string stepName,
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        try
        {
            await step();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to revoke {StepName} for user {UserId} from tenant {TenantId}",
                stepName,
                userId,
                tenantId);
        }
    }
}
