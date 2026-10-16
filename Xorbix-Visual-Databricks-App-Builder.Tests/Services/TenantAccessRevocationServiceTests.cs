using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Tenant access revocation is tenant-scoped (no security-stamp rotation) and resilient to partial failures.
/// </summary>
public class TenantAccessRevocationServiceTests
{
    [Fact]
    public async Task RevokeAsync_RevokesTenantRefreshTokensAndDatabricksTokens_WithoutStampRotation()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        const int connectionId = 7;

        Mock<IRefreshTokenRepository> refreshTokens = new();
        Mock<IDatabricksConnectionRepository> connections = new();
        Mock<IDatabricksUserTokenRepository> databricksTokens = new();

        connections
            .Setup(r => r.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new DatabricksConnection
                {
                    PkId = connectionId,
                    TenantId = tenantId,
                    WorkspaceUrl = "https://example.databricks.com",
                    WorkspaceDisplayName = "ws",
                },
            ]);

        TenantAccessRevocationService sut = new(
            NullLogger<TenantAccessRevocationService>.Instance,
            refreshTokens.Object,
            connections.Object,
            databricksTokens.Object);

        await sut.RevokeAsync(userId, tenantId);

        refreshTokens.Verify(
            r => r.RevokeAllForUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
        refreshTokens.Verify(
            r => r.RevokeAllForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        databricksTokens.Verify(
            r => r.RevokeAsync(userId, connectionId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RevokeAsync_WhenRefreshRevokeThrows_StillRevokesDatabricksTokens()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        const int connectionId = 9;

        Mock<IRefreshTokenRepository> refreshTokens = new();
        Mock<IDatabricksConnectionRepository> connections = new();
        Mock<IDatabricksUserTokenRepository> databricksTokens = new();

        refreshTokens
            .Setup(r => r.RevokeAllForUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("refresh failed"));
        connections
            .Setup(r => r.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new DatabricksConnection
                {
                    PkId = connectionId,
                    TenantId = tenantId,
                    WorkspaceUrl = "https://example.databricks.com",
                    WorkspaceDisplayName = "ws",
                },
            ]);

        TenantAccessRevocationService sut = new(
            NullLogger<TenantAccessRevocationService>.Instance,
            refreshTokens.Object,
            connections.Object,
            databricksTokens.Object);

        await sut.RevokeAsync(userId, tenantId);

        databricksTokens.Verify(
            r => r.RevokeAsync(userId, connectionId, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
